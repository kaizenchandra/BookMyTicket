import { HelpCreationForm } from "../web/features/help-creation.tsx";
import { helpHistoryPage } from "../src/modules/catalog/adapters/help-schema.ts";
import {
  HelpHistory,
  HelpHistoryEntries,
} from "../web/features/help-history.tsx";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { PostgresHelp } from "../src/modules/catalog/adapters/help-postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import { PostgresAudit } from "../src/modules/reporting/adapters/audit.ts";
import {
  helpEditorPage,
  helpSaved,
} from "../src/modules/catalog/adapters/help-schema.ts";
import { HelpArticleEditor } from "../web/features/help-editor.tsx";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
async function account(grant = true, mfa = true) {
  const id = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
    [hashToken(token), id, mfa],
  );
  if (grant)
    await pool.query(
      "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'moderate','platform')",
      [id],
    );
  return { id, headers: { cookie: `session=${token}` } };
}
test("Help editing enforces staff permission, atomic publication, durable retries and audit rollback", async () => {
  const app = await buildApp(),
    actor = await account(),
    other = await account(),
    customer = await account(false),
    stale = await account(true, false);
  const id = `test-${randomUUID()}`,
    marker = randomUUID();
  await pool.query(
    "INSERT INTO catalog.help_articles(id,topic,question,answer,href,action,published) VALUES($1,'booking',$2,'Original answer','/bookings','View bookings',false)",
    [id, marker],
  );
  const url = `/api/v1/admin/help/${id}`;
  const input = {
    question: marker,
    answer: "Updated answer",
    topic: "booking" as const,
    published: true,
    version: 1,
    reason: "Publish verified help",
  };
  const put = (
    payload: unknown = input,
    headers: Record<string, string> = actor.headers,
  ) => app.inject({ method: "PUT", url, payload: payload as object, headers });
  const publicItems = async () =>
    (await app.inject({ url: `/api/v1/help?q=${marker}` })).json().items;
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/admin/help" })).statusCode,
      401,
    );
    for (const who of [customer, stale]) {
      assert.equal(
        (await app.inject({ url: "/api/v1/admin/help", headers: who.headers }))
          .statusCode,
        403,
      );
      assert.equal((await put(input, who.headers)).statusCode, 403);
    }
    const listed = await app.inject({
      url: `/api/v1/admin/help?q=${id}`,
      headers: actor.headers,
    });
    assert.equal(listed.statusCode, 200);
    helpEditorPage.parse(listed.json());
    assert(listed.json().items.some((a: { id: string }) => a.id === id));
    assert.equal((await publicItems()).length, 0);
    for (const patch of [
      { reason: " " },
      { version: 0 },
      { answer: " " },
      { question: "x".repeat(201) },
      { published: "true" },
      { href: "https://evil.invalid" },
    ])
      assert.equal((await put({ ...input, ...patch })).statusCode, 422);
    const results = await Promise.all(Array.from({ length: 6 }, () => put()));
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      helpSaved.parse(result.json());
    }
    assert.equal(results.filter((r) => !r.json().replayed).length, 1);
    assert.equal((await publicItems())[0].answer, "Updated answer");
    assert.equal(
      (await put({ ...input, answer: "Different" })).statusCode,
      409,
    );
    assert.equal((await put(input, other.headers)).statusCode, 409);
    const hidden = {
      ...input,
      version: 2,
      published: false,
      reason: "Withdraw article",
    };
    assert.equal((await put(hidden)).statusCode, 200);
    const retry = await put();
    assert.equal(retry.statusCode, 200);
    assert.equal(retry.json().version, 2);
    assert.equal((await publicItems()).length, 0);
    const store = new PostgresHelp(new PostgresStaffAuthorization(), {
      record: async () => {
        throw new Error("Injected audit failure");
      },
    });
    await assert.rejects(
      store.save(actor.id, id, { ...input, version: 3 }),
      /Injected audit failure/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT version FROM catalog.help_articles WHERE id=$1",
          [id],
        )
      ).rows[0].version,
      3,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM catalog.help_saves WHERE article_id=$1",
          [id],
        )
      ).rows[0].n,
      2,
    );
    await assert.rejects(
      pool.query(
        "UPDATE catalog.help_saves SET reason='rewrite' WHERE article_id=$1",
        [id],
      ),
      /immutable/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='help.saved'",
          [id],
        )
      ).rows[0].n,
      2,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      actor.id,
    ]);
    assert.equal((await put()).statusCode, 403);
    await assert.rejects(
      new PostgresHelp(
        new PostgresStaffAuthorization(),
        new PostgresAudit(),
      ).save(actor.id, id, input),
      /required permission/,
    );
  } finally {
    await pool.query(
      "UPDATE catalog.help_articles SET published=false WHERE id=$1",
      [id],
    );
    await app.close();
  }
});
test("Help editor previews escaped text and requires explicit publication and reason", () => {
  const html = renderToStaticMarkup(
    createElement(HelpArticleEditor, {
      article: {
        id: "fixture",
        version: 1,
        question: "Question",
        answer: "<script>bad()</script>",
        topic: "booking",
        published: false,
        href: "/bookings",
        action: "View bookings",
      },
      reload: () => {},
    }),
  );
  assert(html.includes("Preview"));
  assert(html.includes("Reason for change"));
  assert(html.includes("Published in public Help"));
  assert(html.includes("hidden from public Help"));
  assert(!html.includes("<script>"));
  assert(html.includes("Retry original save") === false);
});

test("Help history paginates real edits, exposes prior snapshots and rechecks audited staff access", async () => {
  const app = await buildApp(),
    staff = await account(),
    customer = await account(false),
    noMfa = await account(true, false);
  const id = `history-${randomUUID()}`,
    url = `/api/v1/admin/help/${id}/history`;
  await pool.query(
    "INSERT INTO catalog.help_articles(id,topic,question,answer,href,action,published) VALUES($1,'booking','Original question','Original answer','/bookings','View bookings',false)",
    [id],
  );
  const store = new PostgresHelp(
    new PostgresStaffAuthorization(),
    new PostgresAudit(),
  );
  const get = (suffix = "", headers = staff.headers) =>
    app.inject({ url: url + suffix, headers });
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal((await get("", customer.headers)).statusCode, 403);
    assert.equal((await get("", noMfa.headers)).statusCode, 403);
    assert.deepEqual(helpHistoryPage.parse((await get()).json()), {
      items: [],
      nextCursor: null,
    });
    for (let version = 1; version <= 22; version++)
      await store.save(staff.id, id, {
        question: `Question ${version}`,
        answer: `Answer ${version}`,
        topic: "booking",
        published: false,
        version,
        reason: `Reason ${version}`,
      });
    const firstResponse = await get(),
      first = helpHistoryPage.parse(firstResponse.json());
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, 3);
    assert.equal(first.items[0].inputVersion, 22);
    assert.equal(first.items[0].version, 23);
    assert.equal(first.items[0].before.answer, "Answer 21");
    assert.equal(first.items[0].reason, "Reason 22");
    assert.equal(first.items[0].actorId, staff.id);
    assert(!firstResponse.body.includes("fingerprint"));
    assert(!firstResponse.body.includes('"href"'));
    await store.save(staff.id, id, {
      question: "Later question",
      answer: "Later answer",
      topic: "booking",
      published: false,
      version: 23,
      reason: "New edit during browsing",
    });
    const second = helpHistoryPage.parse(
      (await get("?beforeVersion=3")).json(),
    );
    assert.deepEqual(
      second.items.map((i) => i.inputVersion),
      [2, 1],
    );
    assert.equal(second.nextCursor, null);
    assert.equal(second.items[1].before.answer, "Original answer");
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.inputVersion))
        .size,
      22,
    );
    for (const query of [
      "0",
      "-1",
      "1.5",
      "2147483648",
      "01",
      "",
      "2&extra=true",
    ])
      assert.equal((await get("?beforeVersion=" + query)).statusCode, 422);
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/help/missing-article/history",
          headers: staff.headers,
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='help.history.read'",
          [id],
        )
      ).rows[0].n,
      3,
    );
    await assert.rejects(
      new PostgresHelp(new PostgresStaffAuthorization(), {
        record: async () => {
          throw new Error("History audit failed");
        },
      }).history(staff.id, id),
      /History audit failed/,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      staff.id,
    ]);
    assert.equal((await get()).statusCode, 403);
    await assert.rejects(store.history(staff.id, id), /required permission/);
  } finally {
    await app.close();
  }
});
test("Help history is explicit-load and labels escaped snapshots as content before an edit", () => {
  const initial = renderToStaticMarkup(
    createElement(HelpHistory, { id: "fixture" }),
  );
  assert(initial.includes("Load article history"));
  assert(initial.includes("keeps your draft"));
  assert(!initial.includes('role="status">Loading history…'));
  const html = renderToStaticMarkup(
    createElement(HelpHistoryEntries, {
      items: [
        {
          inputVersion: 1,
          version: 2,
          actorId: randomUUID(),
          createdAt: "2026-01-01T00:00:00.000Z",
          reason: "<script>reason</script>",
          before: {
            question: "Question",
            answer: "<img src=x>",
            published: false,
            topic: "booking",
          },
        },
      ],
    }),
  );
  assert(html.includes("Content before this edit"));
  assert(html.includes("Unpublished"));
  assert(html.includes("India time"));
  assert(!html.includes("<script>"));
  assert(!html.includes("<img"));
});

test("FAQ creation is unpublished, permission protected and durably retry safe without changing later edits", async () => {
  const app = await buildApp(),
    staff = await account(),
    other = await account(),
    customer = await account(false),
    noMfa = await account(true, false);
  const id = `created-${randomUUID()}`,
    marker = randomUUID();
  const input = {
    id,
    question: marker,
    answer: "New help answer",
    topic: "booking" as const,
    destination: "bookings" as const,
    reason: "Create verified guidance",
  };
  const post = (
    payload: unknown = input,
    headers: Record<string, string> = staff.headers,
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/help",
      payload: payload as object,
      headers,
    });
  try {
    assert.equal((await post(input, {})).statusCode, 401);
    for (const who of [customer, noMfa])
      assert.equal((await post(input, who.headers)).statusCode, 403);
    for (const patch of [
      { id: "UPPER" },
      { id: "bad--id" },
      { id: "" },
      { destination: "https://evil.invalid" },
      { published: true },
      { question: " " },
      { reason: " " },
      { answer: "x".repeat(4001) },
    ])
      assert.equal((await post({ ...input, ...patch })).statusCode, 422);
    const results = await Promise.all(Array.from({ length: 6 }, () => post()));
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      helpSaved.parse(result.json());
    }
    assert.equal(results.filter((r) => !r.json().replayed).length, 1);
    const row = (
      await pool.query("SELECT * FROM catalog.help_articles WHERE id=$1", [id])
    ).rows[0];
    assert.equal(row.published, false);
    assert.equal(row.version, 1);
    assert.equal(row.href, "/bookings");
    assert.equal(
      (await app.inject({ url: `/api/v1/help?q=${marker}` })).json().items
        .length,
      0,
    );
    assert.equal(
      (await post({ ...input, answer: "Different" })).statusCode,
      409,
    );
    assert.equal((await post(input, other.headers)).statusCode, 409);
    assert.equal(
      (await post({ ...input, id: "find-booking" })).statusCode,
      409,
    );
    const store = new PostgresHelp(
      new PostgresStaffAuthorization(),
      new PostgresAudit(),
    );
    await store.save(staff.id, id, {
      question: marker,
      answer: "Published answer",
      topic: "booking",
      published: true,
      version: 1,
      reason: "Publish reviewed answer",
    });
    assert.equal(
      (await app.inject({ url: `/api/v1/help?q=${marker}` })).json().items[0]
        .answer,
      "Published answer",
    );
    assert.equal((await post()).json().version, 1);
    assert.equal(
      (
        await pool.query(
          "SELECT version,published FROM catalog.help_articles WHERE id=$1",
          [id],
        )
      ).rows[0].version,
      2,
    );
    await store.save(staff.id, id, {
      question: marker,
      answer: "Withdrawn answer",
      topic: "booking",
      published: false,
      version: 2,
      reason: "Withdraw",
    });
    assert.equal((await post()).statusCode, 200);
    assert.equal(
      (await app.inject({ url: `/api/v1/help?q=${marker}` })).json().items
        .length,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM catalog.help_creations WHERE article_id=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='help.created'",
          [id],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      pool.query("DELETE FROM catalog.help_creations WHERE article_id=$1", [
        id,
      ]),
      /immutable/,
    );
    const failedId = `failed-${randomUUID()}`;
    await assert.rejects(
      new PostgresHelp(new PostgresStaffAuthorization(), {
        record: async () => {
          throw new Error("Creation audit failed");
        },
      }).create(staff.id, { ...input, id: failedId }),
      /Creation audit failed/,
    );
    assert.equal(
      (
        await pool.query("SELECT id FROM catalog.help_articles WHERE id=$1", [
          failedId,
        ])
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT article_id FROM catalog.help_creations WHERE article_id=$1",
          [failedId],
        )
      ).rowCount,
      0,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      staff.id,
    ]);
    assert.equal((await post()).statusCode, 403);
    await assert.rejects(store.create(staff.id, input), /required permission/);
  } finally {
    await pool.query(
      "UPDATE catalog.help_articles SET published=false WHERE id=$1",
      [id],
    );
    await app.close();
  }
});
test("FAQ creation form explains draft publication and offers controlled internal destinations", () => {
  const html = renderToStaticMarkup(
    createElement(HelpCreationForm, { done: () => {} }),
  );
  assert(html.includes("Create unpublished draft"));
  assert(html.includes("Unique article ID"));
  assert(html.includes("New answers start unpublished"));
  assert(html.includes("Draft preview"));
  assert(html.includes("Action destination"));
  assert(!html.includes("Retry original creation"));
});

test("FAQ administration filters before bounded pagination with stable ID cursors", async () => {
  const app = await buildApp(),
    staff = await account();
  const store = new PostgresHelp(
    new PostgresStaffAuthorization(),
    new PostgresAudit(),
  );
  const prefix = `page-${randomUUID()}`,
    ids: string[] = [];
  const create = async (id: string, question: string) =>
    store.create(staff.id, {
      id,
      question,
      answer: "Pagination fixture",
      topic: "booking",
      destination: "bookings",
      reason: "Verify bounded list",
    });
  const page = async (params: Record<string, string> = {}) => {
    const response = await app.inject({
      url:
        "/api/v1/admin/help?" + new URLSearchParams({ q: prefix, ...params }),
      headers: staff.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    return helpEditorPage.parse(response.json());
  };
  try {
    for (let i = 1; i <= 26; i++) {
      const id = `${prefix}-${String(i).padStart(2, "0")}`;
      ids.push(id);
      await create(id, i === 26 ? `${prefix}% exact literal` : `Question ${i}`);
      if (i <= 3)
        await store.save(staff.id, id, {
          question: `Question ${i}`,
          answer: "Published fixture",
          topic: "booking",
          published: true,
          version: 1,
          reason: "Publish fixture",
        });
    }
    const first = await page();
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, ids[19]);
    assert.deepEqual(
      first.items.map((a) => a.id),
      ids.slice(0, 20),
    );
    const early = `${prefix}-00`;
    await create(early, "New earlier article");
    ids.push(early);
    const second = await page({ after: first.nextCursor! });
    assert.equal(second.nextCursor, null);
    assert.deepEqual(
      second.items.map((a) => a.id),
      ids.slice(20, 26),
    );
    const hidden = await page({ status: "unpublished" });
    assert.equal(hidden.items.length, 20);
    assert(hidden.items.every((a) => !a.published));
    const hiddenNext = await page({
      status: "unpublished",
      after: hidden.nextCursor!,
    });
    assert.equal(hiddenNext.items.length, 4);
    assert.equal(hiddenNext.nextCursor, null);
    const published = await page({
      status: "published",
      q: prefix.toUpperCase(),
    });
    assert.deepEqual(
      published.items.map((a) => a.id),
      ids.slice(0, 3),
    );
    const literal = await page({ q: `${prefix}%` });
    assert.deepEqual(
      literal.items.map((a) => a.id),
      [ids[25]],
    );
    assert.equal((await page({ q: `no-match-${prefix}` })).items.length, 0);
    const before = (await page({ status: "unpublished" })).nextCursor!;
    await store.save(staff.id, ids[25], {
      question: "Changed question",
      answer: "Now published",
      topic: "booking",
      published: true,
      version: 1,
      reason: "Change status during browsing",
    });
    const changed = await page({ status: "unpublished", after: before });
    assert.equal(changed.items.length, 3);
    assert(!changed.items.some((a) => a.id === ids[25]));
    for (const query of [
      "status=invalid",
      "after=UPPER",
      "q=" + "x".repeat(101),
      "limit=1000",
      "status=published&status=unpublished",
    ])
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/admin/help?" + query,
            headers: staff.headers,
          })
        ).statusCode,
        422,
      );
    await assert.rejects(
      new PostgresHelp(new PostgresStaffAuthorization(), {
        record: async () => {
          throw new Error("List audit failure");
        },
      }).list(staff.id, { q: prefix }),
      /List audit failure/,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      staff.id,
    ]);
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/help?q=" + prefix,
          headers: staff.headers,
        })
      ).statusCode,
      403,
    );
    await assert.rejects(
      store.list(staff.id, { q: prefix }),
      /required permission/,
    );
  } finally {
    await pool.query(
      "UPDATE catalog.help_articles SET published=false WHERE id=ANY($1::text[])",
      [ids],
    );
    await app.close();
  }
});
