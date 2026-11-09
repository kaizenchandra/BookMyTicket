import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProviderDraft } from "../web/features/provider-draft.tsx";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
async function account() {
  const id = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
    [hashToken(token), id],
  );
  return { id, headers: { cookie: `session=${token}` } };
}
test("Provider owners correct and resubmit drafts with retry, version and current-role protection", async () => {
  const app = await buildApp(),
    owner = await account(),
    reviewer = await account();
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [reviewer.id],
  );
  const request = (
    method: "POST" | "PUT",
    url: string,
    payload: Record<string, unknown>,
    headers: Record<string, string> = owner.headers,
  ) =>
    app.inject({
      method,
      url,
      payload,
      headers: {
        ...headers,
        ...(url === "/api/v1/organizations"
          ? { "idempotency-key": randomUUID() }
          : {}),
      },
    });
  try {
    const created = await request("POST", "/api/v1/organizations", {
      name: "Original",
      kind: "cinema",
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    await pool.query(
      "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email) VALUES($1,'Fixture business','Fixture address','Fixture contact','fixture@example.invalid')",
      [id],
    );

    const draft = `/api/v1/organizations/${id}/draft`,
      submit = `/api/v1/organizations/${id}/submit`;
    assert.equal(
      (await request("PUT", draft, { name: "Edited", expectedVersion: 1 }, {}))
        .statusCode,
      401,
    );
    assert.equal(
      (
        await request(
          "PUT",
          draft,
          { name: "Edited", expectedVersion: 1 },
          reviewer.headers,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (await request("PUT", draft, { name: " ", expectedVersion: 1 }))
        .statusCode,
      422,
    );
    assert.equal(
      (
        await request("PUT", draft, {
          name: "Edited",
          kind: "event",
          expectedVersion: 1,
        })
      ).statusCode,
      422,
    );
    const edited = await request("PUT", draft, {
      name: " Edited ",
      expectedVersion: 1,
    });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal(edited.json().name, "Edited");
    const retry = await request("PUT", draft, {
      name: "Edited",
      expectedVersion: 1,
    });
    assert.equal(retry.json().version, 2);
    assert.equal(
      (await request("PUT", draft, { name: "Other", expectedVersion: 1 }))
        .statusCode,
      409,
    );
    const submits = await Promise.all([
      request("POST", submit, { version: 2 }),
      request("POST", submit, { version: 2 }),
    ]);
    assert(
      submits.every((r) => r.statusCode === 200 && r.json().version === 3),
    );
    assert.equal(
      (await request("PUT", draft, { name: "Locked", expectedVersion: 3 }))
        .statusCode,
      409,
    );
    const reviewed = await request(
      "POST",
      `/api/v1/admin/providers/${id}/review`,
      {
        version: 3,
        state: "changes_requested",
        reason: "Correct the organization name.",
      },
      reviewer.headers,
    );
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    const race = await Promise.all([
      request("PUT", draft, { name: "Corrected", expectedVersion: 4 }),
      request("PUT", draft, { name: "Different", expectedVersion: 4 }),
    ]);
    assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
    const row = (
      await pool.query("SELECT * FROM providers.organizations WHERE id=$1", [
        id,
      ])
    ).rows[0];
    assert.equal(row.reason, "Correct the organization name.");
    assert.equal(row.state, "changes_requested");
    assert.equal(row.kind, "cinema");
    await pool.query(
      "UPDATE providers.memberships SET role='editor' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal(
      (await request("PUT", draft, { name: "Not allowed", expectedVersion: 5 }))
        .statusCode,
      403,
    );
    assert.equal(
      (await request("POST", submit, { version: 5 })).statusCode,
      403,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='owner' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    const resubmitted = await request("POST", submit, { version: 5 });
    assert.equal(resubmitted.statusCode, 200, resubmitted.body);
    assert.equal(resubmitted.json().state, "submitted");
    assert.equal(resubmitted.json().version, 6);
    assert.equal(
      (
        await request(
          "POST",
          `/api/v1/admin/providers/${id}/review`,
          { version: 6, state: "approved", reason: "Corrections reviewed." },
          reviewer.headers,
        )
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await request("PUT", draft, {
          name: "Approved edit",
          expectedVersion: 7,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await request("POST", submit, { version: 5 })).statusCode,
      200,
    );
  } finally {
    await app.close();
  }
});
test("Provider correction UI exposes escaped feedback and owner resubmission only", () => {
  const org = {
    id: randomUUID(),
    name: "Venue operator",
    kind: "cinema",
    state: "changes_requested",
    role: "owner",
    version: 4,
    reason: "Correct <script>name</script>",
  };
  const html = renderToStaticMarkup(
    createElement(ProviderDraft, { organization: org, onSaved: () => {} }),
  );
  assert(html.includes("Resubmit for review"));
  assert(html.includes("&lt;script&gt;"));
  assert(!html.includes("<script>"));
  const blocked = renderToStaticMarkup(
    createElement(ProviderDraft, {
      organization: org,
      onSaved: () => {},
      blockedByOtherDraft: true,
    }),
  );
  assert.match(blocked, /disabled=""[^>]*>Resubmit for review/);
  for (const change of [
    { role: "viewer" },
    { state: "approved" },
    { state: "submitted" },
  ]) {
    const restricted = renderToStaticMarkup(
      createElement(ProviderDraft, {
        organization: { ...org, ...change },
        onSaved: () => {},
      }),
    );
    assert(!restricted.includes("Resubmit for review"));
    assert(!restricted.includes("Save draft changes"));
  }
});

test("Private onboarding supports incomplete drafts and gates submission with owner-only audited details", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account();
  const request = (
    method: "GET" | "PUT" | "POST",
    url: string,
    payload?: Record<string, unknown>,
    headers: Record<string, string> = owner.headers,
  ) =>
    app.inject({
      method,
      url,
      headers: {
        ...headers,
        ...(url === "/api/v1/organizations"
          ? { "idempotency-key": randomUUID() }
          : {}),
      },
      ...(payload ? { payload } : {}),
    });
  try {
    const created = await request("POST", "/api/v1/organizations", {
      name: "PRIVATE FIXTURE",
      kind: "event",
    });
    const id = created.json().id,
      url = `/api/v1/organizations/${id}/onboarding`;
    const submit = (version: number) =>
      request("POST", `/api/v1/organizations/${id}/submit`, { version });
    assert.equal((await submit(1)).statusCode, 422);
    assert.equal((await request("GET", url, undefined, {})).statusCode, 401);
    assert.equal(
      (await request("GET", url, undefined, other.headers)).statusCode,
      403,
    );
    const empty = (await request("GET", url)).json();
    assert.equal(empty.version, 1);
    assert.equal(empty.details.contactEmail, "");
    const partial = {
      ...empty.details,
      legalName: "Private Business",
      expectedVersion: 1,
    };
    assert.equal(
      (await request("PUT", url, { ...partial, contactEmail: "bad" }))
        .statusCode,
      422,
    );
    assert.equal(
      (await request("PUT", url, { ...partial, payoutAccount: "forbidden" }))
        .statusCode,
      422,
    );
    assert.equal((await request("PUT", url, partial)).statusCode, 200);
    assert.equal((await submit(2)).statusCode, 422);
    const details = {
      legalName: "Private Business",
      businessAddress: "Private address",
      contactName: "Private contact",
      contactEmail: "contact@fixture.invalid",
      contactPhone: "+919876543210",
    };
    const race = await Promise.all([
      request("PUT", url, { ...details, expectedVersion: 2 }),
      request("PUT", url, {
        ...details,
        legalName: "Other private name",
        expectedVersion: 2,
      }),
    ]);
    assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
    const saved = (await request("GET", url)).json();
    assert.equal(saved.version, 3);
    assert.equal(
      (
        await request("PUT", url, { ...saved.details, expectedVersion: 2 })
      ).json().version,
      3,
    );
    const list = await request("GET", "/api/v1/organizations");
    assert(!list.body.includes(details.contactEmail));
    assert(!list.body.includes(details.businessAddress));
    const { PostgresOnboarding } =
      await import("../src/modules/providers/adapters/onboarding.ts");
    const failing = new PostgresOnboarding({
      record: async () => {
        throw new Error("fixture audit failure");
      },
    });
    await assert.rejects(
      failing.save(owner.id, id, {
        ...details,
        legalName: "Rollback",
        expectedVersion: 3,
      }),
      /fixture audit failure/,
    );
    assert.equal((await request("GET", url)).json().version, 3);
    await assert.rejects(
      failing.readOwner(owner.id, id),
      /fixture audit failure/,
    );
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'editor')",
      [id, other.id],
    );
    assert.equal(
      (await request("GET", url, undefined, other.headers)).statusCode,
      403,
    );
    assert.equal(
      (
        await request(
          "PUT",
          url,
          { ...details, expectedVersion: 3 },
          other.headers,
        )
      ).statusCode,
      403,
    );
    const reviewUrl = `/api/v1/admin/providers/${id}/onboarding`;
    assert.equal(
      (await request("GET", reviewUrl, undefined, other.headers)).statusCode,
      403,
    );
    assert.equal((await submit(3)).statusCode, 200);
    assert.equal(
      (await request("PUT", url, { ...details, expectedVersion: 4 }))
        .statusCode,
      409,
    );
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [other.id],
    );
    const reviewed = await request("GET", reviewUrl, undefined, other.headers);
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    assert.deepEqual(reviewed.json().details, saved.details);
    const approval = await request(
      "POST",
      `/api/v1/admin/providers/${id}/review`,
      {
        version: 4,
        state: "approved",
        reason: "Reviewed private business details.",
      },
      other.headers,
    );
    assert.equal(approval.statusCode, 200, approval.body);
    const audit = (
      await pool.query(
        "SELECT action,details FROM reporting.audit WHERE target=$1 AND action LIKE 'provider.onboarding.%'",
        [id],
      )
    ).rows;
    assert(audit.some((r) => r.action === "provider.onboarding.review_read"));
    assert(!JSON.stringify(audit).includes(details.contactEmail));
    assert(!JSON.stringify(audit).includes(details.businessAddress));
  } finally {
    await app.close();
  }
});

test("Provider review history is durable, paginated and private; retries never repeat a transition", async () => {
  const app = await buildApp(),
    owner = await account(),
    reviewer = await account(),
    other = await account();
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [reviewer.id],
  );
  const request = (
    method: "GET" | "POST",
    url: string,
    payload?: Record<string, unknown>,
    headers: Record<string, string> = owner.headers,
  ) =>
    app.inject({
      method,
      url,
      headers: {
        ...headers,
        ...(url === "/api/v1/organizations"
          ? { "idempotency-key": randomUUID() }
          : {}),
      },
      ...(payload ? { payload } : {}),
    });
  try {
    const created = await request("POST", "/api/v1/organizations", {
        name: "HISTORY FIXTURE",
        kind: "cinema",
      }),
      id = created.json().id;
    await pool.query(
      "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email) VALUES($1,'Fixture legal name','Fixture address','Fixture contact','fixture@example.invalid')",
      [id],
    );
    const url = `/api/v1/admin/providers/${id}/review`,
      history = `/api/v1/organizations/${id}/reviews`;
    const initial = {
      version: 2,
      state: "changes_requested",
      reason: "First correction request",
    };
    assert.equal(
      (
        await request("POST", `/api/v1/organizations/${id}/submit`, {
          version: 1,
        })
      ).statusCode,
      200,
    );
    const { PostgresProviderReview } =
      await import("../src/modules/providers/adapters/review.ts");
    await assert.rejects(
      new PostgresProviderReview().review(
        id,
        2,
        "changes_requested",
        "bad",
        reviewer.id,
      ),
    );
    const unchanged = (
      await pool.query(
        "SELECT state,version FROM providers.organizations WHERE id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(unchanged, { state: "submitted", version: 2 });
    const repeats = await Promise.all(
      Array.from({ length: 6 }, () =>
        request("POST", url, initial, reviewer.headers),
      ),
    );
    assert(
      repeats.every((r) => r.statusCode === 200 && r.json().version === 3),
    );
    assert.equal(
      (
        await request(
          "POST",
          url,
          { ...initial, reason: "A different reason" },
          reviewer.headers,
        )
      ).statusCode,
      409,
    );
    let version = 3;
    for (let i = 1; i < 22; i++) {
      const submitted = await request(
        "POST",
        `/api/v1/organizations/${id}/submit`,
        { version },
      );
      assert.equal(submitted.statusCode, 200, submitted.body);
      version = submitted.json().version;
      if (i === 1) {
        assert.equal(
          (await request("POST", url, initial, reviewer.headers)).json()
            .version,
          3,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT state,version FROM providers.organizations WHERE id=$1",
              [id],
            )
          ).rows[0].version,
          version,
        );
      }
      const decided = await request(
        "POST",
        url,
        {
          version,
          state: i === 21 ? "rejected" : "changes_requested",
          reason: `Correction review ${i}`,
        },
        reviewer.headers,
      );
      assert.equal(decided.statusCode, 200, decided.body);
      version = decided.json().version;
    }
    const first = await request("GET", history);
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().items.length, 20);
    assert.equal(first.json().items[0].decision, "rejected");
    assert(!first.body.includes(reviewer.id));
    const next = await request(
      "GET",
      `${history}?beforeVersion=${first.json().nextCursor}`,
    );
    assert.equal(next.json().items.length, 2);
    assert.equal(next.json().nextCursor, null);
    assert.equal(
      new Set(
        [...first.json().items, ...next.json().items].map(
          (r: any) => r.version,
        ),
      ).size,
      22,
    );
    assert.equal(
      (await request("GET", history, undefined, {})).statusCode,
      401,
    );
    assert.equal(
      (await request("GET", history, undefined, other.headers)).statusCode,
      403,
    );
    assert.equal(
      (await request("GET", `${history}?beforeVersion=bad`)).statusCode,
      422,
    );
    const adminHistory = `/api/v1/admin/providers/${id}/reviews`;
    assert.equal((await request("GET", adminHistory)).statusCode, 403);
    const admin = await request(
      "GET",
      adminHistory,
      undefined,
      reviewer.headers,
    );
    assert.equal(admin.statusCode, 200);
    assert.equal(admin.json().items[0].reviewerId, reviewer.id);
    const { PostgresReviewHistory } =
      await import("../src/modules/providers/adapters/review-history.ts");
    await assert.rejects(
      new PostgresReviewHistory(
        {
          record: async () => {
            throw new Error("fixture audit failure");
          },
        },
        {
          requirePermission: async () => {
            throw new Error("unexpected reviewer path");
          },
        },
      ).list(owner.id, id, false),
      /fixture audit failure/,
    );
    await assert.rejects(
      pool.query(
        "UPDATE providers.review_decisions SET reason='Changed history' WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    const old = await request("POST", url, initial, reviewer.headers);
    assert.equal(old.statusCode, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0].state,
      "rejected",
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      reviewer.id,
    ]);
    assert.equal(
      (await request("POST", url, initial, reviewer.headers)).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});

test("Provider queue pages beyond 100 with stable ties, type filters and protected access", async () => {
  const app = await buildApp(),
    owner = await account(),
    reviewer = await account();
  const ids: string[] = [];
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [reviewer.id],
  );
  try {
    // Start beyond persisted fixtures so reruns do not depend on a clean database.
    const boundary = (
      await pool.query(
        `SELECT to_char((greatest(max(created_at),'2099-01-01'::timestamptz)+interval '1 second') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value FROM providers.organizations`,
      )
    ).rows[0].value;
    const createdAt = (
      await pool.query(
        `SELECT to_char(($1::timestamptz+interval '0.123456 second') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value`,
        [boundary],
      )
    ).rows[0].value;
    for (let i = 0; i < 105; i++) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO providers.organizations(id,owner_id,name,kind,state,created_at) VALUES($1,$2,$3,$4,'submitted',$5)",
        [
          id,
          owner.id,
          `Queue fixture ${i}`,
          i % 2 ? "event" : "cinema",
          createdAt,
        ],
      );
    }
    ids.sort();
    const start = {
      afterCreatedAt: boundary,
      afterId: randomUUID(),
    };
    const get = (params: Record<string, string>, headers = reviewer.headers) =>
      app.inject({
        method: "GET",
        url: `/api/v1/admin/providers?${new URLSearchParams(params)}`,
        headers,
      });
    assert.equal(
      (await get({}, {} as typeof reviewer.headers)).statusCode,
      401,
    );
    assert.equal((await get({}, owner.headers)).statusCode, 403);
    const invalidQueries: Record<string, string>[] = [
      { afterId: randomUUID() },
      { afterCreatedAt: start.afterCreatedAt },
      { kind: "movie" },
      { afterId: "invalid", afterCreatedAt: start.afterCreatedAt },
      { unknown: "x" },
    ];
    for (const params of invalidQueries)
      assert.equal((await get(params)).statusCode, 422);
    let cursor: Record<string, string> | null = start,
      seen: string[] = [];
    while (cursor) {
      const response = await get(cursor);
      assert.equal(response.statusCode, 200, response.body);
      const page = response.json();
      assert(page.items.length <= 20);
      assert(page.items.every((item: any) => item.createdAt === createdAt));
      seen.push(...page.items.map((item: any) => item.id));
      cursor = page.nextCursor;
    }
    assert.deepEqual(seen, ids);
    const first = (await get(start)).json();
    // Remove the boundary application from the queue: continuation must still work.
    await pool.query(
      "UPDATE providers.organizations SET state='changes_requested',version=version+1 WHERE id=$1",
      [first.nextCursor.afterId],
    );
    const second = (await get(first.nextCursor)).json();
    assert.deepEqual(
      second.items.map((x: any) => x.id),
      ids.slice(20, 40),
    );
    const filtered = (await get({ ...start, kind: "cinema" })).json();
    assert.equal(filtered.items.length, 20);
    assert(filtered.items.every((x: any) => x.kind === "cinema"));
    const empty = (await get({ ...start, kind: "sports" })).json();
    assert.deepEqual(empty, { items: [], nextCursor: null });
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      reviewer.id,
    ]);
    assert.equal((await get(first.nextCursor)).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("Provider queue navigation preserves filters and exact timestamp boundaries", async () => {
  const { ProviderQueueNavigation, providerQueueSearch } =
    await import("../web/features/provider-queue-navigation.tsx");
  const cursor = {
    afterId: randomUUID(),
    afterCreatedAt: "2099-01-01T00:00:00.123456Z",
  };
  const html = renderToStaticMarkup(
    createElement(ProviderQueueNavigation, {
      kind: "cinema",
      paged: true,
      next: cursor,
    }),
  );
  assert(html.includes("First applications"));
  assert(html.includes("Next applications"));
  assert(html.includes("123456Z"));
  assert(html.includes("kind=cinema"));
  const params = providerQueueSearch(
    `?${new URLSearchParams({ ...cursor, kind: "cinema", secret: "discard" })}`,
  );
  assert.equal(params.get("secret"), null);
  assert.equal(params.get("afterCreatedAt"), cursor.afterCreatedAt);
  assert(
    !renderToStaticMarkup(
      createElement(ProviderQueueNavigation, {
        kind: "",
        paged: false,
        next: null,
      }),
    ).includes("href="),
  );
});

test("Organization creation retries are atomic, actor scoped and require active current ownership", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    key = randomUUID(),
    input = { name: "  Organization retry fixture  ", kind: "event" };
  const create = (
    payload: Record<string, unknown> = input,
    headers: Record<string, string> = {
      ...owner.headers,
      "idempotency-key": key,
    },
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      headers,
      payload,
    });
  try {
    const { PostgresOrganizationCreation } =
      await import("../src/modules/providers/adapters/creation.ts");
    const { PostgresActiveAccount } =
      await import("../src/modules/identity/adapters/active.ts");
    const store = new PostgresOrganizationCreation(new PostgresActiveAccount());
    await assert.rejects(
      store.create(
        owner.id,
        { name: "Rollback fixture", kind: "cinema" },
        "short",
      ),
      { code: "23514" },
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM providers.organizations WHERE owner_id=$1",
          [owner.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM providers.memberships WHERE account_id=$1",
          [owner.id],
        )
      ).rowCount,
      0,
    );
    assert.equal((await create(input, {})).statusCode, 401);
    assert.equal((await create(input, owner.headers)).statusCode, 422);
    for (const bad of ["short", "x".repeat(101)])
      assert.equal(
        (await create(input, { ...owner.headers, "idempotency-key": bad }))
          .statusCode,
        422,
      );
    assert.equal((await create({ ...input, name: "   " })).statusCode, 422);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => create()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), results[0].json());
    }
    const original = results[0].json(),
      id = original.id;
    assert.equal(original.name, "Organization retry fixture");
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM providers.organizations WHERE owner_id=$1",
          [owner.id],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT role FROM providers.memberships WHERE organization_id=$1",
          [id],
        )
      ).rows[0].role,
      "owner",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM providers.creations WHERE actor_id=$1",
          [owner.id],
        )
      ).rowCount,
      1,
    );
    assert.deepEqual(
      (await create({ ...input, name: original.name })).json(),
      original,
    );
    assert.equal(
      (await create({ ...input, name: "Changed name" })).json().code,
      "IDEMPOTENCY_CONFLICT",
    );
    assert.equal((await create({ ...input, kind: "sports" })).statusCode, 409);
    const renamed = await app.inject({
      method: "PUT",
      url: `/api/v1/organizations/${id}/draft`,
      headers: owner.headers,
      payload: { name: "Renamed organization", expectedVersion: 1 },
    });
    assert.equal(renamed.statusCode, 200, renamed.body);
    const details = await app.inject({
      method: "PUT",
      url: `/api/v1/organizations/${id}/onboarding`,
      headers: owner.headers,
      payload: {
        expectedVersion: 2,
        legalName: "Fixture business",
        businessAddress: "Fixture address",
        contactName: "Fixture contact",
        contactEmail: "fixture@example.invalid",
        contactPhone: "",
      },
    });
    assert.equal(details.statusCode, 200, details.body);
    const submitted = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${id}/submit`,
      headers: owner.headers,
      payload: { version: 3 },
    });
    assert.equal(submitted.statusCode, 200, submitted.body);
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [other.id],
    );
    const approved = await app.inject({
      method: "POST",
      url: `/api/v1/admin/providers/${id}/review`,
      headers: other.headers,
      payload: {
        version: 4,
        state: "approved",
        reason: "Organization retry fixture approval",
      },
    });
    assert.equal(approved.statusCode, 200, approved.body);
    assert.deepEqual((await create()).json(), original);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT name,state,version FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0],
      { name: "Renamed organization", state: "approved", version: 5 },
    );
    const differentActor = await create(input, {
      ...other.headers,
      "idempotency-key": key,
    });
    assert.equal(differentActor.statusCode, 200, differentActor.body);
    assert.notEqual(differentActor.json().id, id);
    await assert.rejects(
      pool.query(
        "UPDATE providers.creations SET input='{}' WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM providers.creations WHERE organization_id=$1", [
        id,
      ]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await create()).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await create()).statusCode, 403);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
          [id, owner.id],
        )
      ).rowCount,
      0,
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [other.id],
    );
    assert.equal(
      (await create(input, { ...other.headers, "idempotency-key": key }))
        .statusCode,
      401,
    );
    await assert.rejects(
      store.create(other.id, { name: original.name, kind: "event" }, key),
      { code: "FORBIDDEN" },
    );
  } finally {
    await app.close();
  }
});

test("Provider submission recovery preserves later review state and original actor with atomic persistence", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    reviewer = await account();
  const request = (
    url: string,
    payload: Record<string, unknown>,
    headers = owner.headers,
  ) => app.inject({ method: "POST", url, payload, headers });
  let id = "";
  try {
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [reviewer.id],
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "Recovery provider", kind: "event" },
      headers: { ...owner.headers, "idempotency-key": randomUUID() },
    });
    assert.equal(created.statusCode, 200, created.body);
    id = created.json().id;
    const url = `/api/v1/organizations/${id}/submit`;
    assert.equal((await request(url, { version: 1 })).statusCode, 422);
    await pool.query(
      "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email) VALUES($1,'Recovery business','Business address','Contact','contact@example.invalid')",
      [id],
    );
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [id, other.id],
    );
    for (const version of [0, -1, 1.5, 2147483647])
      assert.equal((await request(url, { version })).statusCode, 422);
    // A failed durable insert must roll back the already-executed state change.
    await pool.query(
      `CREATE FUNCTION providers.test_submission_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.organization_id='${id}'::uuid THEN RAISE EXCEPTION 'fixture durable failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      "CREATE TRIGGER test_submission_failure BEFORE INSERT ON providers.submissions FOR EACH ROW EXECUTE FUNCTION providers.test_submission_failure()",
    );
    assert.equal((await request(url, { version: 1 })).statusCode, 503);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT state,version FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0],
      { state: "draft", version: 1 },
    );
    await pool.query(
      "DROP TRIGGER test_submission_failure ON providers.submissions",
    );
    await pool.query("DROP FUNCTION providers.test_submission_failure()");
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => request(url, { version: 1 })),
    );
    responses.forEach((r) => {
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json(), responses[0].json());
    });
    const original = responses[0].json();
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM providers.submissions WHERE organization_id=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await request(url, { version: 1 }, other.headers)).statusCode,
      409,
    );
    const review = await request(
      `/api/v1/admin/providers/${id}/review`,
      { version: 2, state: "changes_requested", reason: "Please correct name" },
      reviewer.headers,
    );
    assert.equal(review.statusCode, 200, review.body);
    assert.deepEqual((await request(url, { version: 1 })).json(), original);
    const edited = await app.inject({
      method: "PUT",
      url: `/api/v1/organizations/${id}/draft`,
      payload: { name: "Corrected recovery provider", expectedVersion: 3 },
      headers: owner.headers,
    });
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal((await request(url, { version: 4 })).statusCode, 200);
    assert.equal(
      (
        await request(
          `/api/v1/admin/providers/${id}/review`,
          { version: 5, state: "approved", reason: "Reviewed corrections" },
          reviewer.headers,
        )
      ).statusCode,
      200,
    );
    assert.deepEqual((await request(url, { version: 1 })).json(), original);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT state,version,name FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0],
      { state: "approved", version: 6, name: "Corrected recovery provider" },
    );
    assert.equal((await request(url, { version: 6 })).statusCode, 409);
    await assert.rejects(
      pool.query(
        "UPDATE providers.submissions SET result='{}' WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM providers.submissions WHERE organization_id=$1", [
        id,
      ]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await request(url, { version: 1 })).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await request(url, { version: 1 })).statusCode, 403);
  } finally {
    await pool.query(
      "DROP TRIGGER IF EXISTS test_submission_failure ON providers.submissions",
    );
    await pool.query(
      "DROP FUNCTION IF EXISTS providers.test_submission_failure()",
    );
    await app.close();
  }
});

test("Provider draft edits recover original results without overwriting later changes", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    reviewer = await account();
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/organizations",
    payload: { name: "Draft recovery", kind: "sports" },
    headers: { ...owner.headers, "idempotency-key": randomUUID() },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id;
  const edit = (
    name: string,
    expectedVersion: number,
    headers: Record<string, string> = owner.headers,
  ) =>
    app.inject({
      method: "PUT",
      url: `/api/v1/organizations/${id}/draft`,
      payload: { name, expectedVersion },
      headers,
    });
  try {
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [id, other.id],
    );
    assert.equal((await edit("Saved name", 1, {})).statusCode, 401);
    assert.equal(
      (await edit("Saved name", 1, reviewer.headers)).statusCode,
      403,
    );
    for (const version of [0, -1, 1.5, 2147483647])
      assert.equal((await edit("Saved name", version)).statusCode, 422);
    assert.equal((await edit(" ", 1)).statusCode, 422);
    await pool.query(
      `CREATE FUNCTION providers.test_draft_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.organization_id='${id}'::uuid THEN RAISE EXCEPTION 'fixture durable failure'; END IF; RETURN NEW; END $$`,
    );
    await pool.query(
      "CREATE TRIGGER test_draft_failure BEFORE INSERT ON providers.draft_edits FOR EACH ROW EXECUTE FUNCTION providers.test_draft_failure()",
    );
    assert.equal((await edit("Saved name", 1)).statusCode, 503);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT name,version FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0],
      { name: "Draft recovery", version: 1 },
    );
    await pool.query(
      "DROP TRIGGER test_draft_failure ON providers.draft_edits",
    );
    await pool.query("DROP FUNCTION providers.test_draft_failure()");
    const replies = await Promise.all(
      Array.from({ length: 6 }, () => edit(" Saved name ", 1)),
    );
    replies.forEach((r) => {
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json(), replies[0].json());
    });
    const original = replies[0].json();
    assert.equal(original.name, "Saved name");
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int AS n FROM providers.draft_edits WHERE organization_id=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await edit("Other name", 1)).statusCode, 409);
    assert.equal((await edit("Saved name", 1, other.headers)).statusCode, 409);
    assert.equal((await edit("Latest name", 2)).statusCode, 200);
    assert.deepEqual((await edit("Saved name", 1)).json(), original);
    await pool.query(
      "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email) VALUES($1,'Recovery business','Business address','Contact','contact@example.invalid')",
      [id],
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/organizations/${id}/submit`,
          payload: { version: 3 },
          headers: owner.headers,
        })
      ).statusCode,
      200,
    );
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [reviewer.id],
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/admin/providers/${id}/review`,
          payload: { version: 4, state: "approved", reason: "Reviewed" },
          headers: reviewer.headers,
        })
      ).statusCode,
      200,
    );
    assert.deepEqual((await edit("Saved name", 1)).json(), original);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT name,state,version FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0],
      { name: "Latest name", state: "approved", version: 5 },
    );
    assert.equal((await edit("Cannot edit approved", 5)).statusCode, 409);
    await assert.rejects(
      pool.query(
        "UPDATE providers.draft_edits SET name='Changed' WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM providers.draft_edits WHERE organization_id=$1", [
        id,
      ]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='editor' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await edit("Saved name", 1)).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal((await edit("Saved name", 1)).statusCode, 403);
  } finally {
    await pool.query(
      "DROP TRIGGER IF EXISTS test_draft_failure ON providers.draft_edits",
    );
    await pool.query("DROP FUNCTION IF EXISTS providers.test_draft_failure()");
    await app.close();
  }
});

test("Private onboarding save recovery is atomic, audited and preserves later details", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    reviewer = await account();
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/organizations",
    payload: { name: "Private save recovery", kind: "cinema" },
    headers: { ...owner.headers, "idempotency-key": randomUUID() },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id,
    url = `/api/v1/organizations/${id}/onboarding`;
  const details = {
    legalName: "Private legal name",
    businessAddress: "Private business address",
    contactName: "Private contact",
    contactEmail: "private@fixture.invalid",
    contactPhone: "+919876543210",
  };
  const save = (input: Record<string, unknown>, headers = owner.headers) =>
    app.inject({ method: "PUT", url, payload: input, headers });
  const { PostgresOnboarding } =
    await import("../src/modules/providers/adapters/onboarding.ts");
  const failing = new PostgresOnboarding({
    record: async () => {
      throw new Error("fixture audit failure");
    },
  });
  try {
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [id, other.id],
    );
    await assert.rejects(
      failing.save(owner.id, id, { ...details, expectedVersion: 1 }),
      /fixture audit failure/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT version FROM providers.organizations WHERE id=$1",
          [id],
        )
      ).rows[0].version,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM providers.onboarding_saves WHERE organization_id=$1",
          [id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM providers.onboarding_details WHERE organization_id=$1",
          [id],
        )
      ).rowCount,
      0,
    );
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        save({
          ...details,
          legalName: " Private legal name ",
          expectedVersion: 1,
        }),
      ),
    );
    responses.forEach((r) => {
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json(), responses[0].json());
    });
    const original = responses[0].json();
    const records = (
      await pool.query(
        "SELECT * FROM providers.onboarding_saves WHERE organization_id=$1",
        [id],
      )
    ).rows;
    assert.equal(records.length, 1);
    assert.match(records[0].fingerprint, /^[a-f0-9]{64}$/);
    for (const value of Object.values(details))
      assert(!JSON.stringify(records).includes(value));
    const auditRows = (
      await pool.query(
        "SELECT action,details FROM reporting.audit WHERE target=$1",
        [id],
      )
    ).rows;
    assert.equal(
      auditRows.filter((r) => r.action === "provider.onboarding.saved").length,
      1,
    );
    assert.equal(
      auditRows.filter((r) => r.action === "provider.onboarding.save_recovered")
        .length,
      5,
    );
    for (const value of Object.values(details))
      assert(!JSON.stringify(auditRows).includes(value));
    for (const key of Object.keys(details))
      assert.equal(
        (
          await save({
            ...details,
            [key]:
              key === "contactEmail"
                ? "changed@fixture.invalid"
                : key === "contactPhone"
                  ? "+919876543211"
                  : "Changed",
            expectedVersion: 1,
          })
        ).statusCode,
        409,
      );
    assert.equal(
      (await save({ ...details, expectedVersion: 1 }, other.headers))
        .statusCode,
      409,
    );
    await assert.rejects(
      failing.save(owner.id, id, { ...details, expectedVersion: 1 }),
      /fixture audit failure/,
    );
    const latestDetails = {
      ...details,
      businessAddress: "Later address",
      contactEmail: "later@fixture.invalid",
    };
    assert.equal(
      (await save({ ...latestDetails, expectedVersion: 2 })).statusCode,
      200,
    );
    // Different object order must not change the fingerprint.
    const reordered = {
      contactPhone: details.contactPhone,
      contactEmail: details.contactEmail,
      contactName: details.contactName,
      businessAddress: details.businessAddress,
      legalName: details.legalName,
      expectedVersion: 1,
    };
    assert.deepEqual((await save(reordered)).json(), original);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/organizations/${id}/submit`,
          payload: { version: 3 },
          headers: owner.headers,
        })
      ).statusCode,
      200,
    );
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [reviewer.id],
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/admin/providers/${id}/review`,
          payload: { version: 4, state: "approved", reason: "Reviewed" },
          headers: reviewer.headers,
        })
      ).statusCode,
      200,
    );
    assert.deepEqual(
      (await save({ ...details, expectedVersion: 1 })).json(),
      original,
    );
    const current = await app.inject({
      method: "GET",
      url,
      headers: owner.headers,
    });
    assert.deepEqual(current.json(), {
      organizationId: id,
      version: 5,
      state: "approved",
      details: latestDetails,
    });
    assert.equal(
      (await save({ ...latestDetails, expectedVersion: 5 })).statusCode,
      409,
    );
    await assert.rejects(
      pool.query(
        "UPDATE providers.onboarding_saves SET state='draft' WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM providers.onboarding_saves WHERE organization_id=$1",
        [id],
      ),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal(
      (await save({ ...details, expectedVersion: 1 })).statusCode,
      403,
    );
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [id, owner.id],
    );
    assert.equal(
      (await save({ ...details, expectedVersion: 1 })).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
