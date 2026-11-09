import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function actor(permissions: string[] = [], mfa = true) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
    [hashToken(token), id, mfa],
  );
  for (const permission of permissions)
    await pool.query("INSERT INTO identity.grants VALUES($1,$2,'platform')", [
      id,
      permission,
    ]);
  return { id, headers: { cookie: `session=${token}` } };
}
test("Supervisor assignment verifies grants, target eligibility, replay, conflicts and audit", async () => {
  const app = await buildApp(),
    customer = await actor(),
    supervisor = await actor(["support", "support_assign"]),
    agent = await actor(["support"]),
    other = await actor(["support"]),
    weak = await actor(["support", "support_assign"], false);
  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: customer.headers,
      payload: {
        subject: "ISOLATED ASSIGNMENT",
        category: "booking",
        body: "Fixture question",
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    const input = {
        version: 1,
        assigneeId: agent.id,
        reason: "Authorized fixture routing",
      },
      key = randomUUID();
    const assign = (payload = input, who = supervisor, k = key) =>
      app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${id}/assignment`,
        headers: { ...who.headers, "idempotency-key": k },
        payload,
      });
    for (const who of [customer, agent, weak])
      assert.equal((await assign(input, who)).statusCode, 403);
    assert.equal(
      (await assign({ ...input, assigneeId: customer.id })).statusCode,
      403,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => assign()),
    );
    for (const r of results) {
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().version, 2);
      assert.equal(r.json().assigned_to, agent.id);
    }
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE action='support.case.assigned' AND target=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await assign({ ...input, reason: "Changed fixture reason" })).statusCode,
      409,
    );
    assert.equal(
      (await assign(input, supervisor, randomUUID())).statusCode,
      409,
    );
    const changed = await assign(
      { ...input, version: 2, assigneeId: other.id },
      supervisor,
      randomUUID(),
    );
    assert.equal(changed.statusCode, 200, changed.body);
    assert.equal(changed.json().version, 3);
    const reply = await app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${id}/messages`,
      headers: agent.headers,
      payload: {
        version: 3,
        audience: "customer",
        body: "Old agent cannot reply",
      },
    });
    assert.equal(reply.statusCode, 409);
    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='support_assign'",
      [supervisor.id],
    );
    assert.equal((await assign()).statusCode, 403);
  } finally {
    await app.close();
  }
});
test("Assignment rejects inactive targets and serializes competing supervisors", async () => {
  const app = await buildApp(),
    owner = await actor(),
    s1 = await actor(["support", "support_assign"]),
    s2 = await actor(["support", "support_assign"]),
    agent = await actor(["support"]);
  try {
    const c = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: owner.headers,
      payload: {
        subject: "ISOLATED RACE",
        category: "other",
        body: "Fixture question",
      },
    });
    const id = c.json().id;
    const assign = (who = s1, version = 1) =>
      app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${id}/assignment`,
        headers: { ...who.headers, "idempotency-key": randomUUID() },
        payload: {
          version,
          assigneeId: agent.id,
          reason: "Fixture routing reason",
        },
      });
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [agent.id],
    );
    assert.equal((await assign()).statusCode, 403);
    await pool.query(
      "UPDATE identity.accounts SET status='active' WHERE id=$1",
      [agent.id],
    );
    const races = await Promise.all([assign(s1), assign(s2)]);
    assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
    await pool.query("UPDATE support.cases SET state='resolved' WHERE id=$1", [
      id,
    ]);
    assert.equal((await assign(s1, 2)).statusCode, 409);
  } finally {
    await app.close();
  }
});

test("Support directory restricts disclosure, pages results, and assignment rechecks selected agents", async () => {
  const app = await buildApp();
  const supervisor = await actor(["support", "support_assign"]);
  const otherSupervisor = await actor(["support", "support_assign"]);
  const agent = await actor(["support"]);
  const weak = await actor(["support", "support_assign"], false);
  const owner = await actor();
  const prefix = `directory-${randomUUID()}`;
  const eligible: string[] = [];
  try {
    for (let i = 0; i < 27; i++) {
      const a = await actor(["support"]);
      eligible.push(a.id);
      await pool.query("UPDATE identity.accounts SET contact=$2 WHERE id=$1", [
        a.id,
        `${prefix}-${i}@fixture.invalid`,
      ]);
    }
    const suspended = await actor(["support"]),
      tenantOnly = await actor(),
      customer = await actor();
    for (const a of [suspended, tenantOnly, customer])
      await pool.query("UPDATE identity.accounts SET contact=$2 WHERE id=$1", [
        a.id,
        `${prefix}-${a.id}@fixture.invalid`,
      ]);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [suspended.id],
    );
    await pool.query(
      "INSERT INTO identity.grants VALUES($1,'support','organization:fixture')",
      [tenantOnly.id],
    );
    const search = (q = prefix, after = "", who = supervisor) =>
      app.inject({
        method: "GET",
        url: `/api/v1/operations/support-agents?q=${encodeURIComponent(q)}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
        headers: who.headers,
      });
    for (const who of [owner, agent, weak])
      assert.equal((await search(prefix, "", who)).statusCode, 403);
    const first = await search();
    assert.equal(first.statusCode, 200, first.body);
    const { supportDirectoryPage } =
      await import("../src/modules/identity/adapters/support-directory-schema.ts");
    supportDirectoryPage.parse(first.json());
    assert.equal(first.json().items.length, 25);
    const cursor = first.json().nextCursor;
    const second = await search(prefix, cursor);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.json().nextCursor, null);
    assert.deepEqual(
      [...first.json().items, ...second.json().items].map((a) => a.id),
      eligible.sort(),
    );
    assert.equal((await search(prefix + "changed", cursor)).statusCode, 422);
    assert.equal(
      (await search(prefix, cursor, otherSupervisor)).statusCode,
      422,
    );
    assert.equal((await search(prefix, "malformed")).statusCode, 422);
    for (const q of ["", "ab", "x".repeat(255)])
      assert.equal((await search(q)).statusCode, 422);
    assert.equal((await search("%_\\")).json().items.length, 0);
    const selected = eligible[0];
    assert.equal((await search(selected)).json().items[0].id, selected);
    assert.equal((await search(prefix.toUpperCase())).json().items.length, 25);
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: owner.headers,
      payload: {
        subject: "DIRECTORY ELIGIBILITY FIXTURE",
        category: "other",
        body: "Fixture request only",
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      selected,
    ]);
    assert.equal((await search(selected)).json().items.length, 0);
    const assign = await app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${created.json().id}/assignment`,
      headers: { ...supervisor.headers, "idempotency-key": randomUUID() },
      payload: {
        version: 1,
        assigneeId: selected,
        reason: "Selected before permission revocation",
      },
    });
    assert.equal(assign.statusCode, 403, assign.body);
    assert.equal(
      (
        await pool.query(
          "SELECT assigned_to,version FROM support.cases WHERE id=$1",
          [created.json().id],
        )
      ).rows[0].version,
      1,
    );
    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='support_assign'",
      [supervisor.id],
    );
    assert.equal((await search(prefix, cursor)).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("Supervisor assignment notices are atomic, private, deduplicated and historical after reassignment", async () => {
  const app = await buildApp(),
    owner = await actor(),
    supervisor = await actor(["support", "support_assign"]),
    agent = await actor(["support"]),
    other = await actor(["support"]),
    weak = await actor(["support"], false);
  const { PostgresConsumer } =
    await import("../src/modules/reporting/adapters/consumer.ts");
  const { PostgresNotifications } =
    await import("../src/modules/notifications/adapters/postgres.ts");
  const { notificationTypes, notificationTemplate } =
    await import("../src/modules/notifications/domain/template.ts");
  const { transaction } = await import("../src/shared/database.ts");
  try {
    assert.ok(notificationTypes.includes("support.case_assigned"));
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: owner.headers,
      payload: {
        subject: "PRIVATE ASSIGNMENT SUBJECT",
        category: "other",
        body: "PRIVATE CUSTOMER DESCRIPTION",
      },
    });
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id,
      key = randomUUID();
    const assign = (assigneeId = agent.id, version = 1, operationKey = key) =>
      app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${id}/assignment`,
        headers: { ...supervisor.headers, "idempotency-key": operationKey },
        payload: { assigneeId, version, reason: "PRIVATE ASSIGNMENT REASON" },
      });
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => assign()),
    );
    for (const result of attempts)
      assert.equal(result.statusCode, 200, result.body);
    const sources = await pool.query(
      "SELECT * FROM reporting.outbox WHERE aggregate_id=$1 AND type='support.case_assigned'",
      [id],
    );
    assert.equal(sources.rowCount, 1);
    const source = sources.rows[0];
    assert.deepEqual(source.payload, {
      version: 1,
      ownerId: agent.id,
      caseVersion: 2,
    });
    assert.equal((await assign(other.id, 2, randomUUID())).statusCode, 200);
    assert.equal((await assign()).statusCode, 200);
    assert.equal((await assign(other.id)).statusCode, 409);
    assert.equal((await assign(owner.id, 3, randomUUID())).statusCode, 403);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.outbox WHERE aggregate_id=$1 AND type='support.case_assigned'",
          [id],
        )
      ).rows[0].n,
      2,
    );
    const consumer = `fixture.assignment.${randomUUID()}`,
      queue = new PostgresConsumer(),
      store = new PostgresNotifications();
    await pool.query(
      "INSERT INTO reporting.deliveries(event_id,consumer) VALUES($1,$2)",
      [source.id, consumer],
    );
    const handle = (tx: any, event: any) =>
      store.deliver(tx, event, notificationTemplate(event.type));
    await Promise.all([
      queue.once(consumer, [], handle),
      queue.once(consumer, [], handle),
    ]);
    await transaction((tx) => handle(tx, source));
    const inbox = (who = agent) =>
      app.inject({
        method: "GET",
        url: "/api/v1/notifications",
        headers: who.headers,
      });
    const page = await inbox();
    assert.equal(page.statusCode, 200, page.body);
    assert.equal(page.json().items.length, 1);
    const notice = page.json().items[0];
    assert.equal(notice.title, "Support assignment recorded");
    assert.equal(notice.href, `/operations?caseId=${id}`);
    for (const privateValue of [
      "PRIVATE ASSIGNMENT SUBJECT",
      "PRIVATE CUSTOMER DESCRIPTION",
      "PRIVATE ASSIGNMENT REASON",
    ])
      assert.ok(!page.body.includes(privateValue));
    assert.equal((await inbox(owner)).json().items.length, 0);
    assert.equal((await inbox(other)).json().items.length, 0);
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/operations/cases/${id}`,
      headers: agent.headers,
    });
    assert.equal(detail.statusCode, 200, detail.body);
    assert.equal(detail.json().assigned_to, other.id);
    assert.equal(detail.json().version, 3);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/operations/cases/${id}`,
          headers: weak.headers,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/notifications/${notice.id}/read`,
          headers: other.headers,
          payload: {},
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/api/v1/notifications/${notice.id}/read`,
          headers: agent.headers,
          payload: {},
        })
      ).statusCode,
      200,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      agent.id,
    ]);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/operations/cases/${id}`,
          headers: agent.headers,
        })
      ).statusCode,
      403,
    );
    assert.equal((await inbox()).json().items.length, 1); // The generic historical notice grants no case access.
    await assert.rejects(
      transaction((tx) =>
        handle(tx, {
          ...source,
          id: randomUUID(),
          payload: { version: 1, ownerId: agent.id, caseVersion: 0 },
        }),
      ),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT assigned_to,version FROM support.cases WHERE id=$1",
          [id],
        )
      ).rows[0].version,
      3,
    );
  } finally {
    await app.close();
  }
});

test("Directory access audit records bounded identities, excludes search/contact data and rolls back on failure", async () => {
  const app = await buildApp(),
    supervisor = await actor(["support", "support_assign", "audit"]),
    ordinary = await actor(["support"]);
  const prefix = `audit-directory-${randomUUID()}`;
  const ids: string[] = [];
  try {
    for (let n = 0; n < 27; n++) {
      const target = await actor(["support"]);
      ids.push(target.id);
      await pool.query("UPDATE identity.accounts SET contact=$2 WHERE id=$1", [
        target.id,
        `${prefix}-${n}@fixture.invalid`,
      ]);
    }
    const search = (q = prefix, after?: string, who = supervisor) =>
      app.inject({
        method: "GET",
        url: `/api/v1/operations/support-agents?q=${encodeURIComponent(q)}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
        headers: who.headers,
      });
    const audits = () =>
      pool.query(
        "SELECT actor_id,target,details FROM reporting.audit WHERE actor_id=$1 AND action='identity.support_directory.read' ORDER BY id",
        [supervisor.id],
      );
    const first = await search();
    assert.equal(first.statusCode, 200, first.body);
    const second = await search(prefix, first.json().nextCursor);
    assert.equal(second.statusCode, 200, second.body);
    const empty = await search(`missing-${randomUUID()}`);
    assert.equal(empty.statusCode, 200, empty.body);
    const records = (await audits()).rows;
    assert.equal(records.length, 3);
    for (const [index, page] of [first, second, empty].entries()) {
      const row = records[index];
      assert.equal(row.actor_id, supervisor.id);
      assert.equal(row.target, supervisor.id);
      assert.deepEqual(row.details, {
        returnedAccountIds: page.json().items.map((item: any) => item.id),
        count: page.json().items.length,
        olderPage: index === 1,
        hasMore: index === 0,
        outcome: "success",
      });
    }
    assert.ok(!JSON.stringify(records).includes(prefix));
    assert.ok(!JSON.stringify(records).includes("@fixture.invalid"));
    assert.equal((await search(prefix, undefined, ordinary)).statusCode, 403);
    assert.equal((await search(prefix, "invalid")).statusCode, 422);
    assert.equal((await audits()).rows.length, 3);
    // Fault injection after a real audit insert proves the read transaction cannot return unaudited results.
    const { PostgresSupportDirectory } =
      await import("../src/modules/identity/adapters/support-directory.ts");
    const { PostgresAudit } =
      await import("../src/modules/reporting/adapters/audit.ts");
    const failing = new PostgresSupportDirectory({
      record: async (tx, actorId, action, target, details) => {
        await new PostgresAudit().record(tx, actorId, action, target, details);
        throw new Error("ISOLATED AUDIT FAILURE");
      },
    });
    await assert.rejects(
      failing.search(supervisor.id, { q: prefix }),
      /ISOLATED AUDIT FAILURE/,
    );
    assert.equal((await audits()).rows.length, 3);
    assert.equal((await search()).statusCode, 200);
    assert.equal((await audits()).rows.length, 4);
    const history = await app.inject({
      method: "GET",
      url: `/api/v1/admin/audit?action=identity.support_directory.read&actor=${supervisor.id}`,
      headers: supervisor.headers,
    });
    assert.equal(history.statusCode, 200, history.body);
    assert.equal(history.json().items.length, 4);
    assert.ok(!history.body.includes(prefix));
    assert.ok(!history.body.includes(ids[0]!));

    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='support_assign'",
      [supervisor.id],
    );
    assert.equal((await search()).statusCode, 403);
    assert.equal((await audits()).rows.length, 4);
  } finally {
    await app.close();
  }
});
