import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
test("Listing queue pages beyond 100 with stable ties, type filters and protected access", async () => {
  const app = await buildApp(),
    owner = await account(),
    reviewer = await account();
  const ids: string[] = [];
  const organization = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Listing queue fixture','event','approved')",
    [organization, owner.id],
  );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [reviewer.id],
  );
  try {
    // Start beyond persisted fixtures so reruns do not depend on a clean database.
    const boundary = (
      await pool.query(
        `SELECT to_char((greatest(max(created_at),'2099-01-01'::timestamptz)+interval '1 second') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS value FROM catalog.listings`,
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
        "INSERT INTO catalog.listings(id,organization_id,title,kind,state,created_at,city,description) VALUES($1,$2,$3,$4,'submitted',$5,'Fixture City','Queue fixture description')",
        [
          id,
          organization,
          `Queue fixture ${i}`,
          i % 2 ? "event" : "movie",
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
        url: `/api/v1/admin/listings?${new URLSearchParams(params)}`,
        headers,
      });
    assert.equal(
      (await get({}, {} as typeof reviewer.headers)).statusCode,
      401,
    );
    assert.equal((await get({}, owner.headers)).statusCode, 403);
    const { listingQueuePage } =
      await import("../src/modules/catalog/adapters/review-queue-schema.ts");
    const invalidQueries: Record<string, string>[] = [
      { afterId: randomUUID() },
      { afterCreatedAt: start.afterCreatedAt },
      { kind: "cinema" },
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
      listingQueuePage.parse(page);
      assert(page.items.length <= 20);
      assert(page.items.every((item: any) => item.createdAt === createdAt));
      seen.push(...page.items.map((item: any) => item.id));
      cursor = page.nextCursor;
    }
    assert.deepEqual(seen, ids);
    const first = (await get(start)).json();
    // Remove the boundary application from the queue: continuation must still work.
    await pool.query(
      "UPDATE catalog.listings SET state='changes_requested',version=version+1 WHERE id=$1",
      [first.nextCursor.afterId],
    );
    const second = (await get(first.nextCursor)).json();
    assert.deepEqual(
      second.items.map((x: any) => x.id),
      ids.slice(20, 40),
    );
    const filtered = (await get({ ...start, kind: "movie" })).json();
    assert.equal(filtered.items.length, 20);
    assert(filtered.items.every((x: any) => x.kind === "movie"));
    const empty = (await get({ ...start, kind: "sports" })).json();
    assert.deepEqual(empty, { items: [], nextCursor: null });
    const reviewed = filtered.items[0];
    const decision = await app.inject({
      method: "POST",
      url: `/api/v1/admin/listings/${reviewed.id}/review`,
      headers: reviewer.headers,
      payload: {
        version: reviewed.version,
        state: "changes_requested",
        reason: "Please correct the listing details",
      },
    });
    assert.equal(decision.statusCode, 200, decision.body);
    assert.equal(decision.json().state, "changes_requested");
    const stale = await app.inject({
      method: "POST",
      url: `/api/v1/admin/listings/${reviewed.id}/review`,
      headers: reviewer.headers,
      payload: {
        version: reviewed.version,
        state: "published",
        reason: "Stale review must not publish",
      },
    });
    assert.equal(stale.statusCode, 409, stale.body);
    assert(
      !(await get({ ...start, kind: "movie" }))
        .json()
        .items.some((x: any) => x.id === reviewed.id),
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      reviewer.id,
    ]);
    assert.equal((await get(first.nextCursor)).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("Listing review controls escape content and preserve exact navigation boundaries", async () => {
  const { ListingReviewCard, ListingQueueNavigation, listingQueueSearch } =
    await import("../web/features/listing-review-queue.tsx");
  const item = {
    id: randomUUID(),
    organizationId: randomUUID(),
    title: "<script>unsafe</script>",
    description: "<img src=x onerror=alert(1)>",
    city: "Fixture city",
    kind: "movie",
    state: "submitted" as const,
    version: 4,
    createdAt: "2099-01-01T00:00:00.123456Z",
  };
  const html = renderToStaticMarkup(
    createElement(ListingReviewCard, { item, onSaved: () => {} }),
  );
  assert(!html.includes("<script>"));
  assert(!html.includes("<img"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes('name="reason"'));
  assert(html.includes('value="published"'));
  assert(html.includes('value="changes_requested"'));
  assert(html.includes('minLength="5"'));
  const next = { afterId: item.id, afterCreatedAt: item.createdAt };
  const navigation = renderToStaticMarkup(
    createElement(ListingQueueNavigation, { kind: "movie", paged: true, next }),
  );
  assert(navigation.includes("First listings"));
  assert(navigation.includes("Next listings"));
  assert(navigation.includes("kind=movie"));
  assert(navigation.includes("123456Z"));
  assert(navigation.includes("/admin/listings?"));
  const params = listingQueueSearch(
    `?${new URLSearchParams({ ...next, kind: "movie", unrelated: "omit" })}`,
  );
  assert.equal(params.get("unrelated"), null);
  assert.equal(params.get("afterCreatedAt"), item.createdAt);
  assert(
    !renderToStaticMarkup(
      createElement(ListingQueueNavigation, {
        kind: "",
        paged: false,
        next: null,
      }),
    ).includes("href="),
  );
});

test("Listing review decisions are atomic, immutable and retry safe across later transitions", async () => {
  const app = await buildApp(),
    owner = await account(),
    reviewer = await account(),
    other = await account();
  const organization = randomUUID(),
    id = randomUUID();
  for (const actor of [reviewer, other])
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [actor.id],
    );
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Retry fixture','event','approved')",
    [organization, owner.id],
  );
  await pool.query(
    "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
    [organization, owner.id],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'Retry fixture','event','Fixture city','Fixture description','submitted')",
    [id, organization],
  );
  const url = `/api/v1/admin/listings/${id}/review`;
  const payload = {
    version: 1,
    state: "changes_requested",
    reason: "Please correct this fixture",
  };
  const review = (body = payload, headers = reviewer.headers) =>
    app.inject({ method: "POST", url, payload: body, headers });
  try {
    const { PostgresCatalogManagement } =
      await import("../src/modules/catalog/adapters/manage.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const { PostgresStaffAuthorization } =
      await import("../src/modules/identity/adapters/staff-authorization.ts");
    const manager = new PostgresCatalogManagement(
      new PostgresProviders(),
      new PostgresStaffAuthorization(),
    );
    await assert.rejects(
      manager.review(id, 1, "changes_requested", "bad", reviewer.id),
    );
    assert.equal(
      (
        await pool.query("SELECT version FROM catalog.listings WHERE id=$1", [
          id,
        ])
      ).rows[0].version,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.revisions WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (await review({ ...payload, reason: "     " })).statusCode,
      422,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => review()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), results[0].json());
    }
    const recorded = (
      await pool.query(
        "SELECT * FROM catalog.review_decisions WHERE listing_id=$1",
        [id],
      )
    ).rows;
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0].reviewer_id, reviewer.id);
    assert.equal(
      (
        await pool.query(
          "SELECT actor_id FROM catalog.revisions WHERE listing_id=$1",
          [id],
        )
      ).rows[0].actor_id,
      reviewer.id,
    );
    assert.equal(
      (await review({ ...payload, reason: "A changed reason" })).statusCode,
      409,
    );
    assert.equal((await review(payload, other.headers)).statusCode, 409);
    const submitted = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${id}/submit`,
      headers: owner.headers,
      payload: { version: 2 },
    });
    assert.equal(submitted.statusCode, 200, submitted.body);
    assert.equal((await review()).json().version, 2);
    assert.equal(
      (
        await pool.query("SELECT version FROM catalog.listings WHERE id=$1", [
          id,
        ])
      ).rows[0].version,
      3,
    );
    assert.equal(
      (
        await review({
          version: 3,
          state: "published",
          reason: "Fixture corrections approved",
        })
      ).statusCode,
      200,
    );
    // Suspension after publication must never be undone by replaying an old result.
    await pool.query(
      "UPDATE catalog.listings SET state='suspended',version=version+1 WHERE id=$1",
      [id],
    );
    await pool.query(
      "UPDATE providers.organizations SET state='suspended',version=version+1 WHERE id=$1",
      [organization],
    );
    const replay = await review({
      version: 3,
      state: "published",
      reason: "Fixture corrections approved",
    });
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.json().state, "published");
    assert.equal(
      (await pool.query("SELECT state FROM catalog.listings WHERE id=$1", [id]))
        .rows[0].state,
      "suspended",
    );
    await assert.rejects(
      pool.query(
        "UPDATE catalog.review_decisions SET reason='Changed history' WHERE listing_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.review_decisions WHERE listing_id=$1", [
        id,
      ]),
      /immutable/,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      reviewer.id,
    ]);
    assert.equal((await review()).statusCode, 403);
    await assert.rejects(
      manager.review(id, 1, "changes_requested", payload.reason, reviewer.id),
      { code: "FORBIDDEN" },
    );
  } finally {
    await app.close();
  }
});

test("Listing review history paginates and protects reasons, identities and snapshots", async () => {
  const app = await buildApp(),
    owner = await account(),
    viewer = await account(),
    moderator = await account(),
    outsider = await account();
  const org = randomUUID(),
    id = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'History fixture','event','approved')",
    [org, owner.id],
  );
  for (const [actor, role] of [
    [owner.id, "owner"],
    [viewer.id, "viewer"],
  ])
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
      [org, actor, role],
    );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [moderator.id],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state,metadata) VALUES($1,$2,'History fixture','event','Fixture city','Private saved snapshot','submitted','{\"fixturePrivateMarker\":\"omit-from-history\"}')",
    [id, org],
  );
  const url = `/api/v1/listings/${id}/reviews`,
    admin = `/api/v1/admin/listings/${id}/reviews`;
  const get = (path = url, headers = owner.headers) =>
    app.inject({ method: "GET", url: path, headers });
  try {
    assert.deepEqual((await get()).json(), { items: [], nextCursor: null });
    let version = 1;
    for (let i = 0; i < 22; i++) {
      const decision = await app.inject({
        method: "POST",
        url: `/api/v1/admin/listings/${id}/review`,
        headers: moderator.headers,
        payload: {
          version,
          state: "changes_requested",
          reason: `Fixture correction ${i}: <script>escaped</script>`,
        },
      });
      assert.equal(decision.statusCode, 200, decision.body);
      version = decision.json().version;
      if (i < 21) {
        const submitted = await app.inject({
          method: "POST",
          url: `/api/v1/listings/${id}/submit`,
          headers: owner.headers,
          payload: { version },
        });
        assert.equal(submitted.statusCode, 200, submitted.body);
        version = submitted.json().version;
      }
    }
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { listingReviewHistoryPage } =
      await import("../src/modules/catalog/adapters/review-history-schema.ts");
    const page = listingReviewHistoryPage.parse(first.json());
    assert.equal(page.items.length, 20);
    assert.equal(page.items[0].version, 44);
    assert.equal(page.nextCursor, 6);
    assert(!first.body.includes(moderator.id));
    assert(!first.body.includes("omit-from-history"));
    assert(!first.body.includes("Private saved snapshot"));
    const next = (await get(`${url}?beforeVersion=${page.nextCursor}`)).json();
    assert.deepEqual(
      next.items.map((x: any) => x.version),
      [4, 2],
    );
    assert.equal(next.nextCursor, null);
    assert.equal((await get(url, viewer.headers)).statusCode, 200);
    assert.equal((await get(url, outsider.headers)).statusCode, 403);
    assert.equal((await get(url, {} as typeof owner.headers)).statusCode, 401);
    assert.equal((await get(admin)).statusCode, 403);
    for (const suffix of [
      "?beforeVersion=0",
      "?beforeVersion=2.5",
      "?unknown=true",
    ])
      assert.equal((await get(url + suffix)).statusCode, 422);
    assert.equal(
      (await get(`/api/v1/listings/${randomUUID()}/reviews`)).statusCode,
      404,
    );
    const staff = await get(admin, moderator.headers);
    assert.equal(staff.statusCode, 200, staff.body);
    assert.equal(staff.json().items[0].reviewerId, moderator.id);
    const audit = await pool.query(
      "SELECT details FROM reporting.audit WHERE action='listing.review_history.read' AND target=$1",
      [id],
    );
    assert(audit.rowCount! > 0);
    assert(!JSON.stringify(audit.rows).includes("Fixture correction"));
    const { PostgresListingReviewHistory } =
      await import("../src/modules/catalog/adapters/review-history.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const { PostgresStaffAuthorization } =
      await import("../src/modules/identity/adapters/staff-authorization.ts");
    const store = new PostgresListingReviewHistory(
      {
        record: async () => {
          throw new Error("audit unavailable");
        },
      },
      new PostgresStaffAuthorization(),
      new PostgresProviders(),
    );
    await assert.rejects(store.list(owner.id, id, false), /audit unavailable/);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [org, viewer.id],
    );
    assert.equal((await get(url, viewer.headers)).statusCode, 403);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      moderator.id,
    ]);
    assert.equal((await get(admin, moderator.headers)).statusCode, 403);
    await assert.rejects(store.list(moderator.id, id, true), {
      code: "FORBIDDEN",
    });
  } finally {
    await app.close();
  }
});

test("Listing history has an explicit load action and truthful historical scope", async () => {
  const { ListingReviewHistory } =
    await import("../web/features/listing-review-history.tsx");
  const html = renderToStaticMarkup(
    createElement(ListingReviewHistory, { listing: randomUUID() }),
  );
  assert(html.includes("Load review history"));
  assert(
    html.includes("Older moderation records and draft edits are not included"),
  );
  assert(!html.includes("Reviewer reference:"));
});

test("Listing revisions retain exact bigint cursors and protect legacy snapshots and identities", async () => {
  const app = await buildApp(),
    owner = await account(),
    viewer = await account(),
    moderator = await account(),
    outsider = await account();
  const org = randomUUID(),
    id = randomUUID(),
    base =
      9007199254740993n +
      BigInt("0x" + randomUUID().replaceAll("-", "").slice(0, 10));
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind) VALUES($1,$2,'Revision fixture','event')",
    [org, owner.id],
  );
  for (const [actor, role] of [
    [owner.id, "owner"],
    [viewer.id, "viewer"],
  ])
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
      [org, actor, role],
    );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [moderator.id],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description) VALUES($1,$2,'Current title','event','Current city','Current description')",
    [id, org],
  );
  const url = `/api/v1/listings/${id}/revisions`,
    admin = `/api/v1/admin/listings/${id}/revisions`;
  const get = (path = url, headers = owner.headers) =>
    app.inject({ method: "GET", url: path, headers });
  try {
    assert.deepEqual((await get()).json(), { items: [], nextCursor: null });
    // Explicit IDs represent valid retained legacy data beyond JS safe integers; do not reset the database sequence.
    for (let i = 0; i < 23; i++)
      await pool.query(
        "INSERT INTO catalog.revisions(id,listing_id,actor_id,version,snapshot,reason) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4,$5,$6)",
        [
          (base + BigInt(i)).toString(),
          id,
          i === 22 ? null : moderator.id,
          i + 1,
          {
            title: `Saved ${i}`,
            description: "<script>saved content</script>",
            city: "Saved city",
            kind: "event",
            state: "draft",
            metadata: { privateMarker: "must-not-be-returned" },
            poster_url: "https://fixture.invalid/private-image",
            unrecognized: "private-field",
          },
          i % 2 ? "Legacy moderation reason" : null,
        ],
      );
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { listingRevisionPage } =
      await import("../src/modules/catalog/adapters/revision-history-schema.ts");
    const page = listingRevisionPage.parse(first.json());
    assert.equal(page.items.length, 20);
    assert.equal(page.items[0].id, (base + 22n).toString());
    assert.equal(page.nextCursor, (base + 3n).toString());
    assert.equal(page.items[0].snapshot.title, "Saved 22");
    assert.equal(page.items[0].reason, null);
    for (const secret of [
      moderator.id,
      "must-not-be-returned",
      "private-image",
      "private-field",
    ])
      assert(!first.body.includes(secret));
    const next = (await get(`${url}?beforeId=${page.nextCursor}`)).json();
    assert.deepEqual(
      next.items.map((x: any) => x.id),
      [base + 2n, base + 1n, base].map((x) => x.toString()),
    );
    assert.equal(next.nextCursor, null);
    assert.equal((await get(url, viewer.headers)).statusCode, 200);
    assert.equal((await get(url, outsider.headers)).statusCode, 403);
    assert.equal((await get(url, {} as typeof owner.headers)).statusCode, 401);
    assert.equal((await get(admin)).statusCode, 403);
    for (const suffix of [
      "?beforeId=0",
      "?beforeId=-1",
      "?beforeId=1.5",
      "?beforeId=9223372036854775808",
      "?unexpected=x",
    ])
      assert.equal((await get(url + suffix)).statusCode, 422);
    const staff = await get(admin, moderator.headers);
    assert.equal(staff.statusCode, 200, staff.body);
    assert.equal(staff.json().items[0].actorId, null);
    assert.equal(staff.json().items[1].actorId, moderator.id);
    const audit = await pool.query(
      "SELECT details FROM reporting.audit WHERE action='listing.revision_history.read' AND target=$1",
      [id],
    );
    assert(audit.rowCount! > 0);
    assert(!JSON.stringify(audit.rows).includes("Saved city"));
    const comparisonUrl = `${url}/compare?fromId=${base}&toId=${base + 1n}`;
    const compared = await get(comparisonUrl);
    assert.equal(compared.statusCode, 200, compared.body);
    const { listingRevisionComparison } =
      await import("../src/modules/catalog/adapters/revision-history-schema.ts");
    const comparison = listingRevisionComparison.parse(compared.json());
    assert.deepEqual(comparison.changes, [
      { field: "title", before: "Saved 0", after: "Saved 1" },
    ]);
    assert.equal(comparison.from.id, base.toString());
    const reverse = (
      await get(`${url}/compare?fromId=${base + 1n}&toId=${base}`)
    ).json();
    assert.deepEqual(reverse.changes, [
      { field: "title", before: "Saved 1", after: "Saved 0" },
    ]);
    assert(!compared.body.includes(moderator.id));
    assert(!compared.body.includes("must-not-be-returned"));
    assert.equal((await get(comparisonUrl, viewer.headers)).statusCode, 200);
    assert.equal((await get(comparisonUrl, outsider.headers)).statusCode, 403);
    assert.equal(
      (await get(comparisonUrl, {} as typeof owner.headers)).statusCode,
      401,
    );
    assert.equal(
      (await get(`${admin}/compare?fromId=${base}&toId=${base + 1n}`))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await get(
          `${admin}/compare?fromId=${base}&toId=${base + 1n}`,
          moderator.headers,
        )
      ).statusCode,
      200,
    );
    for (const query of [
      `fromId=${base}`,
      `fromId=${base}&toId=${base}`,
      `fromId=1.5&toId=${base}`,
      `fromId=9223372036854775808&toId=${base}`,
      `fromId=${base}&toId=${base + 1n}&extra=x`,
    ])
      assert.equal((await get(`${url}/compare?${query}`)).statusCode, 422);
    const foreign = randomUUID();
    await pool.query(
      "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description) VALUES($1,$2,'Other listing','event','City','Description')",
      [foreign, org],
    );
    const foreignRevision = (
      await pool.query(
        "INSERT INTO catalog.revisions(listing_id,version,snapshot) VALUES($1,1,'{}') RETURNING id::text",
        [foreign],
      )
    ).rows[0].id;
    assert.equal(
      (await get(`${url}/compare?fromId=${base}&toId=${foreignRevision}`))
        .statusCode,
      404,
    );
    assert.equal(
      (await get(`${url}/compare?fromId=${base}&toId=${base + 999n}`))
        .statusCode,
      404,
    );
    const comparisonAudit = await pool.query(
      "SELECT details FROM reporting.audit WHERE action='listing.revision_comparison.read' AND target=$1",
      [id],
    );
    assert(comparisonAudit.rowCount! > 0);
    assert(!JSON.stringify(comparisonAudit.rows).includes("Saved 0"));
    const { PostgresListingRevisionHistory } =
      await import("../src/modules/catalog/adapters/revision-history.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const { PostgresStaffAuthorization } =
      await import("../src/modules/identity/adapters/staff-authorization.ts");
    const store = new PostgresListingRevisionHistory(
      {
        record: async () => {
          throw new Error("audit unavailable");
        },
      },
      new PostgresStaffAuthorization(),
      new PostgresProviders(),
    );
    await assert.rejects(store.list(owner.id, id, false), /audit unavailable/);
    await assert.rejects(
      store.compare(
        owner.id,
        id,
        false,
        base.toString(),
        (base + 1n).toString(),
      ),
      /audit unavailable/,
    );
    await assert.rejects(
      pool.query(
        "UPDATE catalog.revisions SET reason='Change history' WHERE listing_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.revisions WHERE listing_id=$1", [id]),
      /immutable/,
    );
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [org, viewer.id],
    );
    assert.equal((await get(url, viewer.headers)).statusCode, 403);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      moderator.id,
    ]);
    assert.equal((await get(admin, moderator.headers)).statusCode, 403);
    assert.equal((await get(comparisonUrl, viewer.headers)).statusCode, 403);
    assert.equal(
      (
        await get(
          `${admin}/compare?fromId=${base}&toId=${base + 1n}`,
          moderator.headers,
        )
      ).statusCode,
      403,
    );
    await assert.rejects(store.list(moderator.id, id, true), {
      code: "FORBIDDEN",
    });
  } finally {
    await app.close();
  }
});

test("Saved revision cards escape historical text and explain missing attribution", async () => {
  const { ListingRevisionCard, ListingRevisionHistory } =
    await import("../web/features/listing-revision-history.tsx");
  const item = {
    id: "9007199254740993",
    version: 1,
    reason: "<script>reason</script>",
    createdAt: "2026-01-01T00:00:00Z",
    actorId: null,
    snapshot: {
      title: "<img src=x>",
      description: "<script>description</script>",
      city: "Fixture city",
      kind: "event",
      state: "draft",
    },
  };
  const html = renderToStaticMarkup(
    createElement(ListingRevisionCard, { item }),
  );
  assert(!html.includes("<script>"));
  assert(!html.includes("<img"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("Not recorded"));
  assert(html.includes("Before change"));
  assert(html.includes(item.id));
  const member = renderToStaticMarkup(
    createElement(ListingRevisionCard, {
      item: { ...item, actorId: undefined, reason: null },
    }),
  );
  assert(!member.includes("Actor reference"));
  assert(member.includes("No reason was recorded"));
  const initial = renderToStaticMarkup(
    createElement(ListingRevisionHistory, { listing: randomUUID() }),
  );
  assert(initial.includes("Load saved revisions"));
  assert(initial.includes("not the current listing"));
});

test("Revision comparison distinguishes missing and empty values and escapes changed text", async () => {
  const { compareRevisionSnapshots } =
    await import("../src/modules/catalog/domain/revision-comparison.ts");
  const from = {
    title: "<script>old</script>",
    description: null,
    city: "City",
    kind: "event",
    state: "draft",
  };
  assert.deepEqual(compareRevisionSnapshots(from, from), []);
  const changes = compareRevisionSnapshots(from, {
    ...from,
    title: "New title",
    description: "",
  });
  assert.deepEqual(changes, [
    { field: "title", before: from.title, after: "New title" },
    { field: "description", before: null, after: "" },
  ]);
  const { RevisionComparisonResult } =
    await import("../web/features/listing-revision-comparison.tsx");
  const result = {
    from: { id: "9007199254740993", version: 1 },
    to: { id: "9007199254740994", version: 2 },
    changes,
  };
  const html = renderToStaticMarkup(
    createElement(RevisionComparisonResult, { result }),
  );
  assert(!html.includes("<script>"));
  assert(html.includes("&lt;script&gt;"));
  assert(html.includes("Not recorded"));
  assert(html.includes("Empty text"));
  assert(html.includes('scope="col"'));
  assert(html.includes(result.from.id));
  assert(
    renderToStaticMarkup(
      createElement(RevisionComparisonResult, {
        result: { ...result, changes: [] },
      }),
    ).includes("No differences in the compared fields"),
  );
});

test("Category revision history and comparisons expose only saved fields for their listing kind", async () => {
  const app = await buildApp(),
    owner = await account(),
    org = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind) VALUES($1,$2,'Category history fixture','event')",
    [org, owner.id],
  );
  await pool.query(
    "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
    [org, owner.id],
  );
  try {
    const { listingRevisionPage, listingRevisionComparison } =
      await import("../src/modules/catalog/adapters/revision-history-schema.ts");
    for (const [kind, field] of [
      ["movie", "certification"],
      ["event", "minimumAge"],
      ["sports", "teams"],
    ]) {
      const id = randomUUID();
      await pool.query(
        "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description) VALUES($1,$2,'Current listing',$3,'City','Description')",
        [id, org, kind],
      );
      const refs: string[] = [];
      for (const value of ["Before value", "After value"]) {
        const row = await pool.query(
          "INSERT INTO catalog.revisions(listing_id,version,snapshot) VALUES($1,$2,$3) RETURNING id::text",
          [
            id,
            refs.length + 1,
            {
              title: "Saved title",
              description: "Saved description",
              city: "City",
              kind,
              state: "draft",
              metadata: {
                [field]: value,
                privateMarker: "PRIVATE_VALUE",
                managedBy: "PRIVATE_MANAGER",
                posterUrl: "https://fixture.invalid/secret",
                ...(kind === "sports"
                  ? { certification: "WRONG_KIND" }
                  : { teams: "WRONG_KIND" }),
              },
            },
          ],
        );
        refs.push(row.rows[0].id);
      }
      const url = `/api/v1/listings/${id}/revisions`,
        headers = owner.headers;
      const history = await app.inject({ method: "GET", url, headers });
      assert.equal(history.statusCode, 200, history.body);
      const page = listingRevisionPage.parse(history.json());
      assert.equal(
        page.items[0].snapshot.categoryDetails[
          field as keyof (typeof page.items)[0]["snapshot"]["categoryDetails"]
        ],
        "After value",
      );
      for (const secret of [
        "PRIVATE_VALUE",
        "PRIVATE_MANAGER",
        "fixture.invalid",
        "WRONG_KIND",
      ])
        assert(!history.body.includes(secret));
      const compared = await app.inject({
        method: "GET",
        url: `${url}/compare?${new URLSearchParams({ fromId: refs[0], toId: refs[1] })}`,
        headers,
      });
      assert.equal(compared.statusCode, 200, compared.body);
      const result = listingRevisionComparison.parse(compared.json());
      assert.deepEqual(result.changes, [
        {
          field: `categoryDetails.${field}`,
          before: "Before value",
          after: "After value",
        },
      ]);
    }
  } finally {
    await app.close();
  }
});

test("Category snapshot projection rejects malformed metadata and renders saved detail text safely", async () => {
  const { projectRevisionSnapshot, categoryRevisionFieldsByKind } =
    await import("../src/modules/catalog/domain/revision-snapshot.ts");
  const { compareRevisionSnapshots } =
    await import("../src/modules/catalog/domain/revision-comparison.ts");
  for (const kind of ["movie", "event", "sports"]) {
    const projected = projectRevisionSnapshot({
      kind,
      metadata: {
        language: { private: "nested" },
        teams: ["untrusted"],
        duration: 42,
      },
    });
    assert.deepEqual(
      Object.keys(projected.categoryDetails),
      categoryRevisionFieldsByKind[kind],
    );
    assert(
      Object.values(projected.categoryDetails).every((value) => value === null),
    );
  }
  for (const kind of ["unknown", "__proto__", "toString"])
    assert.deepEqual(
      projectRevisionSnapshot({ kind, metadata: { language: "Private" } })
        .categoryDetails,
      {},
    );
  assert.deepEqual(projectRevisionSnapshot(null).categoryDetails, {});
  const before = projectRevisionSnapshot({
    kind: "movie",
    metadata: { language: "", performers: "<script>cast</script>" },
  });
  const after = projectRevisionSnapshot({
    kind: "movie",
    metadata: { language: "Hindi", performers: "<script>cast</script>" },
  });
  assert.deepEqual(compareRevisionSnapshots(before, after), [
    { field: "categoryDetails.language", before: "", after: "Hindi" },
  ]);
  const { ListingRevisionCard } =
    await import("../web/features/listing-revision-history.tsx");
  const html = renderToStaticMarkup(
    createElement(ListingRevisionCard, {
      item: {
        id: "1",
        version: 1,
        reason: null,
        createdAt: "2026-01-01T00:00:00Z",
        snapshot: before,
      },
    }),
  );
  assert(html.includes("Saved category details"));
  assert(html.includes("Cast / performers"));
  assert(html.includes("Empty text"));
  assert(html.includes("Not recorded"));
  assert(html.includes("&lt;script&gt;"));
  assert(!html.includes("<script>"));
  const { RevisionComparisonResult } =
    await import("../web/features/listing-revision-comparison.tsx");
  const comparison = renderToStaticMarkup(
    createElement(RevisionComparisonResult, {
      result: {
        from: { id: "1", version: 1 },
        to: { id: "2", version: 2 },
        changes: compareRevisionSnapshots(before, after),
      },
    }),
  );
  assert(comparison.includes("Language"));
  assert(!comparison.includes("categoryDetails.language"));
});

test("Expanded category history labels distinguish uncaptured legacy fields from future saves", async () => {
  const { projectRevisionSnapshot } =
    await import("../src/modules/catalog/domain/revision-snapshot.ts");
  const { compareRevisionSnapshots } =
    await import("../src/modules/catalog/domain/revision-comparison.ts");
  const { ListingRevisionCard } =
    await import("../web/features/listing-revision-history.tsx");
  for (const [kind, field, label] of [
    ["movie", "crew", "Crew"],
    ["event", "exclusions", "Exclusions"],
    ["sports", "hospitality", "Hospitality"],
  ]) {
    const legacy = projectRevisionSnapshot({ kind, metadata: {} }),
      saved = projectRevisionSnapshot({
        kind,
        metadata: { [field]: "<script>supplied details</script>" },
      });
    assert.equal(
      legacy.categoryDetails[field as keyof typeof legacy.categoryDetails],
      null,
    );
    assert.deepEqual(compareRevisionSnapshots(legacy, saved), [
      {
        field: `categoryDetails.${field}`,
        before: null,
        after: "<script>supplied details</script>",
      },
    ]);
    const html = renderToStaticMarkup(
      createElement(ListingRevisionCard, {
        item: {
          id: "1",
          version: 1,
          reason: null,
          createdAt: "2026-01-01T00:00:00Z",
          snapshot: saved,
        },
      }),
    );
    assert(html.includes(label));
    assert(html.includes("&lt;script&gt;"));
    assert(!html.includes("<script>"));
  }
});

test("Listing submission retries preserve one transition and never resurrect later review states", async () => {
  const app = await buildApp(),
    owner = await account(),
    editor = await account(),
    moderator = await account();
  const org = randomUUID(),
    id = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Submission fixture','event','approved')",
    [org, owner.id],
  );
  for (const [actor, role] of [
    [owner.id, "owner"],
    [editor.id, "editor"],
  ])
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
      [org, actor, role],
    );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [moderator.id],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description) VALUES($1,$2,'Submit fixture','event','City','Description')",
    [id, org],
  );
  const url = `/api/v1/listings/${id}/submit`,
    submit = (version = 1, headers = owner.headers) =>
      app.inject({ method: "POST", url, headers, payload: { version } });
  try {
    assert.equal((await submit(1, {} as typeof owner.headers)).statusCode, 401);
    for (const version of [0, -1, 1.5, 2147483647])
      assert.equal((await submit(version)).statusCode, 422);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => submit()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), results[0].json());
    }
    assert.equal(results[0].json().version, 2);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.revisions WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.submissions WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      1,
    );
    assert.equal((await submit(1, editor.headers)).statusCode, 409);
    assert.equal((await submit(2)).statusCode, 409);
    const review = (version: number, state: string) =>
      app.inject({
        method: "POST",
        url: `/api/v1/admin/listings/${id}/review`,
        headers: moderator.headers,
        payload: { version, state, reason: "Submission retry fixture review" },
      });
    assert.equal((await review(2, "changes_requested")).statusCode, 200);
    assert.equal((await submit()).json().version, 2);
    assert.equal(
      (await pool.query("SELECT state FROM catalog.listings WHERE id=$1", [id]))
        .rows[0].state,
      "changes_requested",
    );
    assert.equal((await submit(3)).statusCode, 200);
    assert.equal((await review(4, "published")).statusCode, 200);
    await pool.query(
      "UPDATE providers.organizations SET state='suspended',version=version+1 WHERE id=$1",
      [org],
    );
    const replay = await submit();
    assert.equal(replay.statusCode, 200, replay.body);
    assert.deepEqual(replay.json(), results[0].json());
    assert.equal(
      (await pool.query("SELECT state FROM catalog.listings WHERE id=$1", [id]))
        .rows[0].state,
      "published",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.submissions WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      2,
    );
    await assert.rejects(
      pool.query(
        "UPDATE catalog.submissions SET result='{}' WHERE listing_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.submissions WHERE listing_id=$1", [id]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await submit()).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await submit()).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("Generic draft edit replay is payload scoped and cannot overwrite later edits or publication", async () => {
  const app = await buildApp(),
    owner = await account(),
    editor = await account(),
    outsider = await account(),
    moderator = await account(),
    org = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Draft edit fixture','event','approved')",
    [org, owner.id],
  );
  for (const [actor, role] of [
    [owner.id, "owner"],
    [editor.id, "editor"],
  ])
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
      [org, actor, role],
    );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [moderator.id],
  );
  const input = {
    title: "Original title",
    kind: "event",
    city: "Fixture city",
    description: "Original fixture description",
    metadata: {},
  };
  try {
    const created = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org}/listings`,
      headers: { ...owner.headers, "idempotency-key": randomUUID() },
      payload: input,
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id,
      url = `/api/v1/listings/${id}`;
    const payload = {
      ...input,
      title: "  Updated title  ",
      metadata: { z: "Last", a: "First" },
      version: 1,
    };
    const update = (
      body: Record<string, unknown> = payload,
      headers = owner.headers,
    ) => app.inject({ method: "PUT", url, headers, payload: body });
    assert.equal(
      (await update(payload, {} as typeof owner.headers)).statusCode,
      401,
    );
    assert.equal((await update(payload, outsider.headers)).statusCode, 403);
    assert.equal(
      (await update({ ...payload, version: 2147483647 })).statusCode,
      422,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => update()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), results[0].json());
    }
    assert.equal(results[0].json().title, "Updated title");
    assert.equal(results[0].json().version, 2);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.revisions WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.draft_edits WHERE listing_id=$1",
          [id],
        )
      ).rowCount,
      1,
    );
    const reordered = await update({
      ...payload,
      title: "Updated title",
      metadata: { a: "First", z: "Last" },
    });
    assert.equal(reordered.statusCode, 200, reordered.body);
    assert.deepEqual(reordered.json(), results[0].json());
    assert.equal(
      (await update({ ...payload, title: "Different title" })).statusCode,
      409,
    );
    assert.equal(
      (await update({ ...payload, metadata: { a: "Changed" } })).statusCode,
      409,
    );
    assert.equal((await update(payload, editor.headers)).statusCode, 409);
    const later = await update({
      ...payload,
      title: "Later title",
      version: 2,
    });
    assert.equal(later.statusCode, 200, later.body);
    const submit = await app.inject({
      method: "POST",
      url: `${url}/submit`,
      headers: owner.headers,
      payload: { version: 3 },
    });
    assert.equal(submit.statusCode, 200, submit.body);
    const review = await app.inject({
      method: "POST",
      url: `/api/v1/admin/listings/${id}/review`,
      headers: moderator.headers,
      payload: {
        version: 4,
        state: "published",
        reason: "Approve fixture publication",
      },
    });
    assert.equal(review.statusCode, 200, review.body);
    const replay = await update();
    assert.equal(replay.statusCode, 200, replay.body);
    assert.deepEqual(replay.json(), results[0].json());
    const current = (
      await pool.query(
        "SELECT title,state,version FROM catalog.listings WHERE id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(current, {
      title: "Later title",
      state: "published",
      version: 5,
    });
    assert.equal((await update({ ...payload, version: 5 })).statusCode, 409);
    await assert.rejects(
      pool.query(
        "UPDATE catalog.draft_edits SET input='{}' WHERE listing_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.draft_edits WHERE listing_id=$1", [id]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await update()).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await update()).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("Generic creation keys prevent duplicates and are isolated by actor and organization", async () => {
  const app = await buildApp(),
    owner = await account(),
    editor = await account(),
    outsider = await account(),
    moderator = await account(),
    org = randomUUID(),
    otherOrg = randomUUID(),
    key = randomUUID();
  for (const oid of [org, otherOrg]) {
    await pool.query(
      "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Creation fixture','event','approved')",
      [oid, owner.id],
    );
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [oid, owner.id],
    );
  }
  await pool.query(
    "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'editor')",
    [org, editor.id],
  );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
    [moderator.id],
  );
  const input = {
    title: "  Creation fixture  ",
    kind: "event",
    city: "Fixture city",
    description: "Isolated creation fixture content",
    metadata: { z: "Last", a: "First" },
  };
  const create = (
    payload: Record<string, unknown> = input,
    headers: Record<string, string> = {
      ...owner.headers,
      "idempotency-key": key,
    },
    oid = org,
  ) =>
    app.inject({
      method: "POST",
      url: `/api/v1/organizations/${oid}/listings`,
      headers,
      payload,
    });
  try {
    const { PostgresCatalogManagement } =
      await import("../src/modules/catalog/adapters/manage.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const { PostgresStaffAuthorization } =
      await import("../src/modules/identity/adapters/staff-authorization.ts");
    const manager = new PostgresCatalogManagement(
      new PostgresProviders(),
      new PostgresStaffAuthorization(),
    );
    await assert.rejects(
      manager.create(owner.id, org, { ...input, kind: "event" }, "short"),
      { code: "23514" },
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.listings WHERE organization_id=$1",
          [org],
        )
      ).rowCount,
      0,
      "Failed durable record insert rolls back listing creation",
    );

    assert.equal((await create(input, {})).statusCode, 401);
    assert.equal((await create(input, owner.headers)).statusCode, 422);
    for (const invalid of ["short", "x".repeat(101)])
      assert.equal(
        (await create(input, { ...owner.headers, "idempotency-key": invalid }))
          .statusCode,
        422,
      );
    assert.equal(
      (await create(input, { ...outsider.headers, "idempotency-key": key }))
        .statusCode,
      403,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => create()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(result.json(), results[0].json());
    }
    const original = results[0].json(),
      id = original.id;
    assert.equal(original.title, "Creation fixture");
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.listings WHERE organization_id=$1",
          [org],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.creations WHERE actor_id=$1 AND organization_id=$2",
          [owner.id, org],
        )
      ).rowCount,
      1,
    );
    const reordered = await create({
      ...input,
      title: "Creation fixture",
      metadata: { a: "First", z: "Last" },
    });
    assert.equal(reordered.statusCode, 200, reordered.body);
    assert.deepEqual(reordered.json(), original);
    assert.equal(
      (await create({ ...input, title: "Different listing" })).json().code,
      "IDEMPOTENCY_CONFLICT",
    );
    assert.equal(
      (await create({ ...input, metadata: { a: "Different" } })).statusCode,
      409,
    );
    const edited = await app.inject({
      method: "PUT",
      url: `/api/v1/listings/${id}`,
      headers: owner.headers,
      payload: { ...input, title: "Newer title", version: 1 },
    });
    assert.equal(edited.statusCode, 200, edited.body);
    const submitted = await app.inject({
      method: "POST",
      url: `/api/v1/listings/${id}/submit`,
      headers: owner.headers,
      payload: { version: 2 },
    });
    assert.equal(submitted.statusCode, 200, submitted.body);
    const reviewed = await app.inject({
      method: "POST",
      url: `/api/v1/admin/listings/${id}/review`,
      headers: moderator.headers,
      payload: {
        version: 3,
        state: "published",
        reason: "Creation fixture approved",
      },
    });
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    assert.deepEqual((await create()).json(), original);
    assert.deepEqual(
      (
        await pool.query(
          "SELECT title,state,version FROM catalog.listings WHERE id=$1",
          [id],
        )
      ).rows[0],
      { title: "Newer title", state: "published", version: 4 },
    );
    const otherActor = await create(input, {
      ...editor.headers,
      "idempotency-key": key,
    });
    assert.equal(otherActor.statusCode, 200, otherActor.body);
    assert.notEqual(otherActor.json().id, id);
    const otherOrganization = await create(
      input,
      { ...owner.headers, "idempotency-key": key },
      otherOrg,
    );
    assert.equal(otherOrganization.statusCode, 200, otherOrganization.body);
    assert.notEqual(otherOrganization.json().id, id);
    await assert.rejects(
      pool.query(
        "UPDATE catalog.creations SET input='{}' WHERE listing_id=$1",
        [id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.creations WHERE listing_id=$1", [id]),
      /immutable/,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await create()).statusCode, 403);
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [org, owner.id],
    );
    assert.equal((await create()).statusCode, 403);
  } finally {
    await app.close();
  }
});
