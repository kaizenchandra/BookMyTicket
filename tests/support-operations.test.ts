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
async function fixture() {
  const app = await buildApp();
  async function account(staff = false, mfa = true) {
    const id = randomUUID(),
      token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, `${id}@fixture.invalid`],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
      [hashToken(token), id, mfa],
    );
    if (staff)
      await pool.query(
        "INSERT INTO identity.grants VALUES($1,'support','platform')",
        [id],
      );
    return { id, headers: { cookie: `session=${token}` } };
  }
  const owner = await account(),
    agent = await account(true),
    other = await account(true),
    stranger = await account(),
    noMfa = await account(true, false);
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/cases",
    headers: owner.headers,
    payload: {
      subject: "ISOLATED SUPPORT FIXTURE",
      category: "booking",
      body: "Fixture support question, not a real customer.",
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id;
  const action = (
    actor: typeof owner,
    version: number,
    action: string,
    extra = {},
  ) =>
    app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${id}/actions`,
      headers: actor.headers,
      payload: { version, action, reason: "Isolated test reason", ...extra },
    });
  const detail = () =>
    app.inject({
      method: "GET",
      url: `/api/v1/operations/cases/${id}`,
      headers: agent.headers,
    });
  return { app, owner, agent, other, stranger, noMfa, id, action, detail };
}
test("support lifecycle, audience privacy, access controls and audit persist through real HTTP", async () => {
  const f = await fixture();
  try {
    for (const actor of [f.owner, f.stranger, f.noMfa])
      assert.equal(
        (
          await f.app.inject({
            method: "GET",
            url: `/api/v1/operations/cases/${f.id}`,
            headers: actor.headers,
          })
        ).statusCode,
        403,
      );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: `/api/v1/cases/${f.id}/messages`,
          headers: f.stranger.headers,
        })
      ).statusCode,
      404,
    );
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 200);
    assert.equal((await f.action(f.other, 2, "resolve")).statusCode, 409);
    const note = await f.app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${f.id}/messages`,
      headers: f.agent.headers,
      payload: {
        version: 2,
        audience: "internal",
        body: "INTERNAL FIXTURE SECRET",
      },
    });
    assert.equal(note.statusCode, 200, note.body);
    const customer = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
    });
    assert.ok(!customer.body.includes("INTERNAL FIXTURE SECRET"));
    const reply = () =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${f.id}/messages`,
        headers: f.agent.headers,
        payload: {
          version: 3,
          audience: "customer",
          body: "CUSTOMER FIXTURE REPLY",
        },
      });
    assert.equal((await reply()).statusCode, 200);
    assert.equal((await reply()).statusCode, 409);
    assert.equal(
      (await f.action(f.agent, 4, "priority", { priority: "urgent" }))
        .statusCode,
      200,
    );
    assert.equal((await f.action(f.agent, 5, "escalate")).statusCode, 200);
    const queue = await f.app.inject({
      method: "GET",
      url: "/api/v1/operations/cases?state=escalated&priority=urgent&assignment=unassigned&category=booking",
      headers: f.agent.headers,
    });
    assert.ok(queue.json().items.some((r: any) => r.id === f.id));
    assert.equal((await f.action(f.other, 6, "claim")).statusCode, 200);
    assert.equal((await f.action(f.other, 7, "resolve")).statusCode, 200);
    assert.equal(
      (await f.action(f.other, 8, "priority", { priority: "low" })).statusCode,
      409,
    );
    // A genuine customer reply reopens a resolved case and invalidates stale staff actions.
    const incoming = await f.app.inject({
      method: "POST",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
      payload: { body: "Still need assistance." },
    });
    assert.equal(incoming.statusCode, 200);
    const d = (await f.detail()).json();
    assert.equal(d.state, "open");
    assert.equal(d.assigned_to, null);
    assert.equal(d.version, 9);
    assert.ok(d.messages.some((m: any) => m.audience === "internal"));
    assert.equal((await f.action(f.other, 8, "reopen")).statusCode, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='support.case.reply'",
          [f.id],
        )
      ).rows[0].n,
      2,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await f.detail()).statusCode, 403);
  } finally {
    await f.app.close();
  }
});
test("simultaneous claims and a lost-response retry cannot overwrite the winner", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      f.action(f.agent, 1, "claim"),
      f.action(f.other, 1, "claim"),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const d = (await f.detail()).json();
    assert.equal(d.version, 2);
    assert.ok([f.agent.id, f.other.id].includes(d.assigned_to));
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 409);
    assert.equal((await f.detail()).json().version, 2);
  } finally {
    await f.app.close();
  }
});

test("Customer escalation is owner-only, atomic, retry-safe and visible to support", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(),
      payload = {
        version: 1,
        reason: "The issue remains unresolved and needs further review.",
      };
    const request = (who = f.owner, body = payload, k = key) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/cases/${f.id}/escalation`,
        headers: { ...who.headers, "idempotency-key": k },
        payload: body,
      });
    assert.equal((await request(f.stranger)).statusCode, 404);
    assert.equal((await request(f.agent)).statusCode, 404);
    assert.equal(
      (await request(f.owner, { ...payload, reason: "short" })).statusCode,
      422,
    );
    const results = await Promise.all(
      Array.from({ length: 6 }, () => request()),
    );
    for (const r of results) {
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().state, "escalated");
      assert.equal(r.json().version, 2);
    }
    assert.equal(
      (
        await request(f.owner, {
          ...payload,
          reason: "Different escalation reason",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await request(f.owner, { ...payload, version: 2 }, randomUUID()))
        .statusCode,
      409,
    );
    const detail = (await f.detail()).json();
    assert.equal(detail.assigned_to, null);
    assert.equal(
      detail.messages.filter((m: any) =>
        m.body.startsWith("Escalation requested:"),
      ).length,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='support.case.customer_escalation'",
          [f.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await f.action(f.agent, 2, "claim")).statusCode, 200);
    // Lost-response replay must not undo the agent's later claim.
    assert.equal((await request()).statusCode, 200);
    assert.equal((await f.detail()).json().assigned_to, f.agent.id);
  } finally {
    await f.app.close();
  }
});
test("Customer escalation conflicts with staff changes and resolved cases require reopening", async () => {
  const f = await fixture();
  try {
    const escalate = (version: number) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/cases/${f.id}/escalation`,
        headers: { ...f.owner.headers, "idempotency-key": randomUUID() },
        payload: {
          version,
          reason: "Please review this unresolved issue further.",
        },
      });
    const race = await Promise.all([
      escalate(1),
      f.action(f.agent, 1, "claim"),
    ]);
    assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
    let detail = (await f.detail()).json();
    if (!detail.assigned_to) {
      assert.equal(
        (await f.action(f.agent, detail.version, "claim")).statusCode,
        200,
      );
      detail = (await f.detail()).json();
    }
    assert.equal(
      (await f.action(f.agent, detail.version, "resolve")).statusCode,
      200,
    );
    detail = (await f.detail()).json();
    assert.equal((await escalate(detail.version)).statusCode, 409);
  } finally {
    await f.app.close();
  }
});

test("Case creation retries are atomic, actor-scoped and preserve later case changes", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(),
      payload = {
        subject: "ISOLATED RETRY CASE",
        category: "other",
        body: "A repeat-safe fixture support request.",
      };
    const create = (who = f.owner, body = payload, k: string = key) =>
      f.app.inject({
        method: "POST",
        url: "/api/v1/cases",
        headers: { ...who.headers, "idempotency-key": k },
        payload: body,
      });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => create()),
    );
    for (const result of results)
      assert.equal(result.statusCode, 200, result.body);
    const ids = new Set(results.map((r) => r.json().id));
    assert.equal(ids.size, 1);
    const id = results[0].json().id;
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM support.messages WHERE case_id=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE action='support.case.created' AND target=$1",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (await create(f.owner, { ...payload, body: "Changed request payload" }))
        .statusCode,
      409,
    );
    const other = await create(f.stranger);
    assert.equal(other.statusCode, 200);
    assert.notEqual(other.json().id, id);
    await pool.query(
      "UPDATE support.cases SET state='resolved',version=2 WHERE id=$1",
      [id],
    );
    const replay = await create();
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().replayed, true);
    assert.equal(
      (await pool.query("SELECT state FROM support.cases WHERE id=$1", [id]))
        .rows[0].state,
      "resolved",
    );
    assert.equal((await create(f.owner, payload, "short")).statusCode, 422);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [f.owner.id],
    );
    assert.equal((await create()).statusCode, 401);
  } finally {
    await f.app.close();
  }
});

test("Customer and staff reply retries commit one message and cannot reopen later resolution", async () => {
  const f = await fixture();
  try {
    const customerKey = randomUUID(),
      staffKey = randomUUID();
    const customer = (body = "Repeated customer follow-up", who = f.owner) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/cases/${f.id}/messages`,
        headers: { ...who.headers, "idempotency-key": customerKey },
        payload: { body },
      });
    const customers = await Promise.all(
      Array.from({ length: 6 }, () => customer()),
    );
    for (const r of customers) assert.equal(r.statusCode, 200, r.body);
    assert.equal(new Set(customers.map((r) => r.json().id)).size, 1);
    assert.equal((await customer("Changed follow-up")).statusCode, 409);
    assert.equal(
      (await customer("Repeated customer follow-up", f.stranger)).statusCode,
      404,
    );
    let detail = (await f.detail()).json();
    assert.equal(detail.version, 2);
    assert.equal((await f.action(f.agent, 2, "claim")).statusCode, 200);
    const input = {
      version: 3,
      audience: "internal",
      body: "Private staff note fixture",
    };
    const staff = (payload = input) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${f.id}/messages`,
        headers: { ...f.agent.headers, "idempotency-key": staffKey },
        payload,
      });
    const replies = await Promise.all(Array.from({ length: 6 }, () => staff()));
    for (const r of replies) assert.equal(r.statusCode, 200, r.body);
    assert.equal(new Set(replies.map((r) => r.json().id)).size, 1);
    assert.equal(
      (await staff({ ...input, audience: "customer" })).statusCode,
      409,
    );
    const publicMessages = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
    });
    assert.ok(!publicMessages.body.includes("Private staff note fixture"));
    assert.equal((await f.action(f.agent, 4, "resolve")).statusCode, 200);
    assert.equal((await customer()).json().replayed, true);
    assert.equal((await staff()).json().replayed, true);
    detail = (await f.detail()).json();
    assert.equal(detail.state, "resolved");
    assert.equal(detail.version, 5);
    assert.equal(detail.messages.length, 3);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await staff()).statusCode, 403);
  } finally {
    await f.app.close();
  }
});

test("support queue pages preserve timestamp ties, scope and current authorization", async () => {
  const f = await fixture();
  const ids = Array.from({ length: 205 }, () => randomUUID());
  try {
    await pool.query(
      `INSERT INTO support.cases(id,owner_id,subject,category,assigned_to,created_at)
       SELECT id,$2,'ISOLATED QUEUE FIXTURE','other',$3,
         '2026-01-01T12:00:00.123456Z'::timestamptz
       FROM unnest($1::uuid[]) id`,
      [ids, f.owner.id, f.agent.id],
    );
    const get = (suffix = "", headers = f.agent.headers) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/operations/cases?assignment=mine${suffix}`,
        headers,
      });
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { casePage } =
      await import("../src/modules/support/adapters/schemas.ts");
    casePage.parse(first.json());
    assert.equal(first.json().items.length, 100);
    const cursor = first.json().nextCursor;
    assert.ok(cursor);
    assert.match(
      JSON.parse(Buffer.from(cursor, "base64url").toString()).time,
      /123456Z$/,
    );
    // A new case arriving ahead of the boundary must not duplicate earlier rows.
    const added = randomUUID();
    ids.push(added);
    await pool.query(
      `INSERT INTO support.cases(id,owner_id,subject,category,assigned_to)
       VALUES($1,$2,'NEW QUEUE FIXTURE','other',$3)`,
      [added, f.owner.id, f.agent.id],
    );
    const second = await get(`&after=${cursor}`);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.json().items.length, 100);
    const third = await get(`&after=${second.json().nextCursor}`);
    assert.equal(third.statusCode, 200, third.body);
    assert.equal(third.json().items.length, 5);
    assert.equal(third.json().nextCursor, null);
    const actual = [first, second, third].flatMap((r) =>
      r.json().items.map((i: any) => i.id),
    );
    assert.deepEqual(actual, ids.slice(0, 205).sort().reverse());
    assert.equal(new Set(actual).size, 205);
    assert.equal((await get(`&after=${cursor}&state=open`)).statusCode, 422);
    assert.equal(
      (await get(`&after=${cursor}`, f.other.headers)).statusCode,
      422,
    );
    for (const value of ["bad", "", "x".repeat(2001)])
      assert.equal((await get(`&after=${value}`)).statusCode, 422);
    assert.equal((await get("&unknown=true")).statusCode, 422);
    for (const actor of [f.owner, f.noMfa])
      assert.equal(
        (await get(`&after=${cursor}`, actor.headers)).statusCode,
        403,
      );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await get(`&after=${cursor}`)).statusCode, 403);
  } finally {
    await pool.query("DELETE FROM support.cases WHERE id=ANY($1::uuid[])", [
      ids,
    ]);
    await f.app.close();
  }
});

test("Keyed workflow actions recover original outcomes without repeating transitions or audits", async () => {
  const f = await fixture();
  const send = (
    action: string,
    version: number,
    key: string,
    who = f.agent,
    extra = {},
  ) =>
    f.app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${f.id}/actions`,
      headers: { ...who.headers, "idempotency-key": key },
      payload: { action, version, reason: "ISOLATED ACTION RETRY", ...extra },
    });
  try {
    const claimKey = randomUUID();
    const claims = await Promise.all(
      Array.from({ length: 6 }, () => send("claim", 1, claimKey)),
    );
    for (const result of claims) {
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(result.json().version, 2);
      assert.equal(result.json().assigned_to, f.agent.id);
    }
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='support.case.claim'",
          [f.id],
        )
      ).rows[0].n,
      1,
    );
    for (const extra of [{ reason: "Changed reason" }, { priority: "urgent" }])
      assert.equal(
        (await send("claim", 1, claimKey, f.agent, extra)).statusCode,
        409,
      );
    assert.equal((await send("release", 2, claimKey)).statusCode, 409);
    assert.equal((await send("claim", 2, claimKey)).statusCode, 409);
    let version = 2;
    const saved: Array<{
      action: string;
      version: number;
      key: string;
      extra: any;
    }> = [];
    for (const action of [
      "priority",
      "escalate",
      "claim",
      "resolve",
      "reopen",
      "claim",
      "release",
    ]) {
      const key = randomUUID(),
        extra = action === "priority" ? { priority: "urgent" } : {};
      const result = await send(action, version, key, f.agent, extra);
      assert.equal(result.statusCode, 200, result.body);
      const retry = await send(action, version, key, f.agent, extra);
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(retry.json().replayed, true);
      assert.equal(retry.json().version, version + 1);
      saved.push({ action, version, key, extra });
      version++;
    }
    // A different actor can use the same key for their own command.
    const nextClaim = await send("claim", version, claimKey, f.other);
    assert.equal(nextClaim.statusCode, 200, nextClaim.body);
    version++;
    for (const original of saved) {
      const replay = await send(
        original.action,
        original.version,
        original.key,
        f.agent,
        original.extra,
      );
      assert.equal(replay.statusCode, 200, replay.body);
      assert.equal(replay.json().version, original.version + 1);
    }
    assert.equal((await send("claim", 1, claimKey)).statusCode, 200);
    const current = await f.detail();
    assert.equal(current.json().version, version);
    assert.equal(current.json().state, "in_progress");
    assert.equal(current.json().assigned_to, f.other.id);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM support.action_commands WHERE actor_id=$1",
          [f.agent.id],
        )
      ).rows[0].n,
      8,
    );
    const failedKey = randomUUID();
    assert.equal((await send("resolve", version, failedKey)).statusCode, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM support.action_commands WHERE actor_id=$1 AND operation_key=$2",
          [f.agent.id, failedKey],
        )
      ).rows[0].n,
      0,
    );
    assert.equal((await send("claim", 1, "short")).statusCode, 422);
    for (const who of [f.owner, f.noMfa])
      assert.equal((await send("claim", 1, claimKey, who)).statusCode, 403);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await send("claim", 1, claimKey)).statusCode, 403);
  } finally {
    await f.app.close();
  }
});

test("Customer-visible staff replies produce one private durable inbox notice and an owned case link", async () => {
  const f = await fixture();
  const { PostgresConsumer } =
    await import("../src/modules/reporting/adapters/consumer.ts");
  const { PostgresNotifications } =
    await import("../src/modules/notifications/adapters/postgres.ts");
  const { notificationTypes, notificationTemplate } =
    await import("../src/modules/notifications/domain/template.ts");
  const { transaction } = await import("../src/shared/database.ts");
  try {
    assert.ok(notificationTypes.includes("support.staff_replied"));
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 200);
    const key = randomUUID();
    const reply = (audience: string, version: number, operationKey: string) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${f.id}/messages`,
        headers: { ...f.agent.headers, "idempotency-key": operationKey },
        payload: {
          version,
          audience,
          body:
            audience === "internal"
              ? "PRIVATE NOTE FIXTURE"
              : "CUSTOMER BODY FIXTURE",
        },
      });
    const attempts = await Promise.all(
      Array.from({ length: 6 }, () => reply("customer", 2, key)),
    );
    for (const r of attempts) assert.equal(r.statusCode, 200, r.body);
    const events = await pool.query(
      "SELECT * FROM reporting.outbox WHERE aggregate_id=$1 AND type='support.staff_replied'",
      [f.id],
    );
    assert.equal(events.rowCount, 1);
    const event = events.rows[0];
    assert.deepEqual(event.payload, {
      version: 1,
      ownerId: f.owner.id,
      messageId: attempts[0].json().id,
    });
    assert.equal((await reply("internal", 3, randomUUID())).statusCode, 200);
    assert.equal((await reply("customer", 2, randomUUID())).statusCode, 409);
    assert.equal((await f.action(f.agent, 4, "resolve")).statusCode, 200);
    assert.equal((await reply("customer", 2, key)).statusCode, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.outbox WHERE aggregate_id=$1 AND type='support.staff_replied'",
          [f.id],
        )
      ).rows[0].n,
      1,
    );
    // Process the real persisted event using an isolated consumer name, without draining other fixtures.
    const consumer = `fixture.support.${randomUUID()}`,
      queue = new PostgresConsumer(),
      store = new PostgresNotifications();
    await pool.query(
      "INSERT INTO reporting.deliveries(event_id,consumer) VALUES($1,$2)",
      [event.id, consumer],
    );
    const handle = (tx: any, source: any) =>
      store.deliver(tx, source, notificationTemplate(source.type));
    await Promise.all([
      queue.once(consumer, [], handle),
      queue.once(consumer, [], handle),
    ]);
    await transaction((tx) => handle(tx, event)); // Duplicate delivery is harmless.
    const inbox = await f.app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: f.owner.headers,
    });
    assert.equal(inbox.statusCode, 200, inbox.body);
    assert.equal(inbox.json().items.length, 1);
    const notice = inbox.json().items[0];
    assert.equal(notice.href, `/cases?caseId=${f.id}`);
    assert.equal(notice.title, "Support replied to your case");
    assert.ok(!inbox.body.includes("PRIVATE NOTE FIXTURE"));
    assert.ok(!inbox.body.includes("CUSTOMER BODY FIXTURE"));
    assert.ok(!inbox.body.includes("ISOLATED SUPPORT FIXTURE"));
    await pool.query(
      `INSERT INTO support.cases(id,owner_id,subject,category,created_at)
       SELECT id,$2,'ISOLATED NEWER CASE','other',clock_timestamp()
       FROM unnest($1::uuid[]) id`,
      [Array.from({ length: 101 }, () => randomUUID()), f.owner.id],
    );
    const recent = await f.app.inject({
      method: "GET",
      url: "/api/v1/cases",
      headers: f.owner.headers,
    });
    assert.equal(recent.json().items.length, 100);
    assert.ok(!recent.json().items.some((item: any) => item.id === f.id));
    const selected = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases?caseId=${f.id}`,
      headers: f.owner.headers,
    });
    assert.equal(selected.statusCode, 200, selected.body);
    assert.equal(selected.json().items[0].id, f.id);
    assert.equal(selected.json().items[0].state, "resolved");
    const foreign = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases?caseId=${f.id}`,
      headers: f.stranger.headers,
    });
    assert.deepEqual(foreign.json().items, []);
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/cases?caseId=invalid",
          headers: f.owner.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/notifications",
          headers: f.stranger.headers,
        })
      ).json().items.length,
      0,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: `/api/v1/notifications/${notice.id}/read`,
          headers: f.stranger.headers,
          payload: {},
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: `/api/v1/notifications/${notice.id}/read`,
          headers: f.owner.headers,
          payload: {},
        })
      ).statusCode,
      200,
    );
    const messages = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
    });
    assert.ok(messages.body.includes("CUSTOMER BODY FIXTURE"));
    assert.ok(!messages.body.includes("PRIVATE NOTE FIXTURE"));
    await assert.rejects(
      transaction((tx) =>
        handle(tx, {
          ...event,
          id: randomUUID(),
          payload: { version: 1, ownerId: f.owner.id },
        }),
      ),
    );
  } finally {
    await f.app.close();
  }
});

test("Customer case history traverses timestamp ties without exposing other owners or internal data", async () => {
  const f = await fixture();
  const ids = Array.from({ length: 205 }, () => randomUUID());
  try {
    await pool.query(
      `INSERT INTO support.cases(id,owner_id,subject,category,created_at)
      SELECT id,$2,'ISOLATED HISTORY FIXTURE','other','2090-01-01T12:00:00.123456Z'::timestamptz
      FROM unnest($1::uuid[]) id`,
      [ids, f.owner.id],
    );
    const get = (suffix = "", who = f.owner) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/cases${suffix}`,
        headers: who.headers,
      });
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { customerCasePage } =
      await import("../src/modules/support/adapters/schemas.ts");
    customerCasePage.parse(first.json());
    assert.equal(first.json().items.length, 100);
    const cursor = first.json().nextCursor;
    assert.match(
      JSON.parse(Buffer.from(cursor, "base64url").toString()).time,
      /123456Z$/,
    );
    const newer = randomUUID();
    await pool.query(
      `INSERT INTO support.cases(id,owner_id,subject,category,created_at)
      VALUES($1,$2,'ISOLATED NEW ARRIVAL','other','2091-01-01T00:00:00Z')`,
      [newer, f.owner.id],
    );
    await pool.query(
      "UPDATE support.cases SET state='resolved',version=version+1 WHERE id=$1",
      [first.json().items[0].id],
    );
    const second = await get(`?after=${cursor}`);
    assert.equal(second.statusCode, 200, second.body);
    const third = await get(`?after=${second.json().nextCursor}`);
    assert.equal(third.statusCode, 200, third.body);
    assert.equal(third.json().nextCursor, null);
    const actual = [first, second, third].flatMap((r) =>
      r.json().items.map((c: any) => c.id),
    );
    assert.deepEqual(actual, [...ids.sort().reverse(), f.id]);
    assert.equal(new Set(actual).size, 206);
    assert.equal((await get()).json().items[0].id, newer);
    const exact = await get(`?caseId=${f.id}`);
    assert.equal(exact.json().items.length, 1);
    assert.equal(exact.json().nextCursor, null);
    assert.deepEqual(
      (await get(`?caseId=${f.id}`, f.stranger)).json().items,
      [],
    );
    assert.equal((await get(`?after=${cursor}`, f.stranger)).statusCode, 422);
    assert.equal(
      (await get(`?caseId=${f.id}&after=${cursor}`)).statusCode,
      422,
    );
    for (const value of ["invalid", "", "x".repeat(2001)])
      assert.equal((await get(`?after=${value}`)).statusCode, 422);
    assert.equal((await get("?unexpected=true")).statusCode, 422);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [f.owner.id],
    );
    assert.equal((await get(`?after=${cursor}`)).statusCode, 401);
  } finally {
    await f.app.close();
  }
});

test("Customer conversations page visible messages with precise boundaries and owner/case isolation", async () => {
  const f = await fixture();
  const ids = Array.from({ length: 105 }, () => randomUUID());
  try {
    await pool.query(
      `INSERT INTO support.messages(id,case_id,author_id,audience,body,created_at)
      SELECT id,$2,$3,'customer','ISOLATED VISIBLE MESSAGE','2090-01-01T12:00:00.123456Z'::timestamptz
      FROM unnest($1::uuid[]) id`,
      [ids, f.id, f.owner.id],
    );
    await pool.query(
      `INSERT INTO support.messages(id,case_id,author_id,audience,body,created_at)
      SELECT id,$2,$3,'internal','PRIVATE PAGINATION FIXTURE','2092-01-01T00:00:00Z'::timestamptz
      FROM unnest($1::uuid[]) id`,
      [Array.from({ length: 60 }, () => randomUUID()), f.id, f.agent.id],
    );
    const initial = (
      await pool.query(
        "SELECT id FROM support.messages WHERE case_id=$1 AND created_at<'2090-01-01'",
        [f.id],
      )
    ).rows[0].id;
    const get = (after?: string, who = f.owner, id = f.id) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/cases/${id}/messages${after !== undefined ? `?after=${encodeURIComponent(after)}` : ""}`,
        headers: who.headers,
      });
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { customerMessagePage } =
      await import("../src/modules/support/adapters/schemas.ts");
    customerMessagePage.parse(first.json());
    assert.equal(first.json().items.length, 50);
    assert.ok(!first.body.includes("PRIVATE PAGINATION FIXTURE"));
    const cursor = first.json().nextCursor;
    assert.match(
      JSON.parse(Buffer.from(cursor, "base64url").toString()).time,
      /123456Z$/,
    );
    const newer = randomUUID();
    await pool.query(
      `INSERT INTO support.messages(id,case_id,author_id,audience,body,created_at)
      VALUES($1,$2,$3,'customer','NEW VISIBLE FIXTURE','2091-01-01T00:00:00Z')`,
      [newer, f.id, f.owner.id],
    );
    const second = await get(cursor),
      third = await get(second.json().nextCursor);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(third.statusCode, 200, third.body);
    assert.equal(third.json().items.length, 6);
    assert.equal(third.json().nextCursor, null);
    const expected = [...ids.sort().reverse(), initial];
    const visited = [first, second, third].flatMap((r) =>
      r
        .json()
        .items.map((m: any) => m.id)
        .reverse(),
    );
    assert.deepEqual(visited, expected);
    assert.equal(new Set(visited).size, 106);
    const latest = await get();
    assert.equal(latest.json().items.at(-1).id, newer);
    const otherCase = await f.app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: f.owner.headers,
      payload: {
        subject: "SECOND CONVERSATION FIXTURE",
        category: "other",
        body: "Fixture thread for cursor scope",
      },
    });
    assert.equal(
      (await get(cursor, f.owner, otherCase.json().id)).statusCode,
      422,
    );
    assert.equal((await get(cursor, f.stranger)).statusCode, 404);
    assert.equal((await get(undefined, f.stranger)).statusCode, 404);
    for (const bad of ["", "malformed", "x".repeat(2001)])
      assert.equal((await get(bad)).statusCode, 422);
    const post = await f.app.inject({
      method: "POST",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: { ...f.owner.headers, "idempotency-key": randomUUID() },
      payload: { body: "Reply while browsing older messages" },
    });
    assert.equal(post.statusCode, 200, post.body);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [f.owner.id],
    );
    assert.equal((await get(cursor)).statusCode, 401);
  } finally {
    await f.app.close();
  }
});

test("Staff thread pages retain audience labels, audit each read and recheck permissions without advancing edits", async () => {
  const f = await fixture(),
    ids = Array.from({ length: 105 }, () => randomUUID());
  try {
    await pool.query(
      `INSERT INTO support.messages(id,case_id,author_id,audience,body,created_at)
      SELECT id,$2,$3,CASE WHEN n%2=0 THEN 'internal' ELSE 'customer' END,
      'ISOLATED STAFF THREAD','2090-01-01T12:00:00.123456Z'::timestamptz
      FROM unnest($1::uuid[]) WITH ORDINALITY t(id,n)`,
      [ids, f.id, f.agent.id],
    );
    const initial = (
      await pool.query(
        "SELECT id FROM support.messages WHERE case_id=$1 AND created_at<'2090-01-01'",
        [f.id],
      )
    ).rows[0].id;
    const get = (after?: string, who = f.agent, id = f.id) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/operations/cases/${id}${after !== undefined ? `?after=${encodeURIComponent(after)}` : ""}`,
        headers: who.headers,
      });
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const { staffCaseDetailPage } =
      await import("../src/modules/support/adapters/schemas.ts");
    staffCaseDetailPage.parse(first.json());
    assert.equal(first.json().messages.length, 50);
    const cursor = first.json().nextMessageCursor;
    assert.match(
      JSON.parse(Buffer.from(cursor, "base64url").toString()).time,
      /123456Z$/,
    );
    const added = randomUUID();
    await pool.query(
      `INSERT INTO support.messages(id,case_id,author_id,audience,body,created_at)
      VALUES($1,$2,$3,'internal','NEW PRIVATE NOTE','2091-01-01T00:00:00Z')`,
      [added, f.id, f.agent.id],
    );
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 200);
    const second = await get(cursor),
      third = await get(second.json().nextMessageCursor);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(third.statusCode, 200, third.body);
    assert.equal(second.json().version, 2);
    assert.equal(third.json().nextMessageCursor, null);
    assert.equal(third.json().messages.length, 6);
    const seen = [first, second, third].flatMap((r) =>
      r
        .json()
        .messages.map((m: any) => m.id)
        .reverse(),
    );
    assert.deepEqual(seen, [...ids.sort().reverse(), initial]);
    const messages = [first, second, third].flatMap((r) => r.json().messages);
    assert.equal(messages.filter((m) => m.audience === "internal").length, 52);
    assert.equal((await get()).json().messages.at(-1).id, added);
    // Paging does not authorize an action with the originally captured stale version.
    assert.equal(
      (await f.action(f.agent, first.json().version, "resolve")).statusCode,
      409,
    );
    assert.equal(
      (
        await pool.query("SELECT version FROM support.cases WHERE id=$1", [
          f.id,
        ])
      ).rows[0].version,
      2,
    );
    const audits = (
      await pool.query(
        "SELECT details FROM reporting.audit WHERE action='support.case.read' AND target=$1",
        [f.id],
      )
    ).rows;
    assert.equal(audits.length, 4);
    assert.deepEqual(
      audits.map((a) => a.details.messageCount).sort((a, b) => a - b),
      [6, 50, 50, 50],
    );
    assert.ok(!JSON.stringify(audits).includes("ISOLATED STAFF THREAD"));
    assert.equal((await get(cursor, f.other)).statusCode, 422);
    const otherCase = await f.app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: f.owner.headers,
      payload: {
        subject: "STAFF CURSOR SCOPE FIXTURE",
        category: "other",
        body: "Another fixture conversation",
      },
    });
    assert.equal(
      (await get(cursor, f.agent, otherCase.json().id)).statusCode,
      422,
    );
    for (const who of [f.owner, f.noMfa])
      assert.equal((await get(cursor, who)).statusCode, 403);
    for (const bad of ["", "invalid", "x".repeat(2001)])
      assert.equal((await get(bad)).statusCode, 422);
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await get(cursor)).statusCode, 403);
    const customer = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
    });
    assert.ok(
      customer.json().items.every((m: any) => m.audience === "customer"),
    );
    assert.ok(!customer.body.includes("NEW PRIVATE NOTE"));
  } finally {
    await f.app.close();
  }
});
