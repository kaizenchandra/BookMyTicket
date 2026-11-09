import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool, transaction } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { PostgresEvents } from "../src/modules/reporting/adapters/outbox.ts";
import { PostgresConsumer } from "../src/modules/reporting/adapters/consumer.ts";
import { PostgresNotifications } from "../src/modules/notifications/adapters/postgres.ts";
import { notificationTemplate } from "../src/modules/notifications/domain/template.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account() {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
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
async function event(owner: string, type: string) {
  const booking = randomUUID();
  await transaction((tx) =>
    new PostgresEvents().publish(tx, type, booking, { ownerId: owner }),
  );
  return (
    await pool.query("SELECT * FROM reporting.outbox WHERE aggregate_id=$1", [
      booking,
    ])
  ).rows[0];
}
test("atomic consumer deduplicates concurrent deliveries, exposes owner-only pages and durable read state", async () => {
  const owner = await account(),
    other = await account(),
    app = await buildApp(),
    store = new PostgresNotifications(),
    queue = new PostgresConsumer(),
    type = `fixture.notifications.${randomUUID()}`,
    consumer = `fixture.${randomUUID()}`;
  try {
    // Unique fixture type isolates processing from other tests; payload is the real v1 outbox envelope.
    const source = await event(owner.id, type);
    const handle = (tx: any, e: any) =>
      store.deliver(tx, e, notificationTemplate("booking.confirmed"));
    await Promise.all([
      queue.once(consumer, [type], handle),
      queue.once(consumer, [type], handle),
    ]);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM notifications.messages WHERE event_id=$1",
          [source.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(await queue.once(consumer, [type], handle), false);
    const page = await app.inject({
      method: "GET",
      url: "/api/v1/notifications",
      headers: owner.headers,
    });
    assert.equal(page.statusCode, 200);
    const id = page.json().items[0].id;
    assert.equal(page.json().items[0].href, `/bookings/${source.aggregate_id}`);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/notifications",
          headers: other.headers,
        })
      ).json().items.length,
      0,
    );
    const read = (who = owner) =>
      app.inject({
        method: "POST",
        url: `/api/v1/notifications/${id}/read`,
        headers: who.headers,
        payload: {},
      });
    assert.equal((await read(other)).statusCode, 404);
    const first = await read();
    assert.equal(first.statusCode, 200);
    assert.equal((await read()).json().read_at, first.json().read_at);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/notifications?unread=true",
          headers: owner.headers,
        })
      ).json().items.length,
      0,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/notifications?after=${id}`,
          headers: other.headers,
        })
      ).statusCode,
      422,
    );
    for (let i = 0; i < 22; i++) {
      const e = await event(owner.id, type);
      await transaction((tx) => handle(tx, e));
    }
    const p1 = await store.list(owner.id);
    assert.equal(p1.items.length, 20);
    assert.ok(p1.nextCursor);
    const p2 = await store.list(owner.id, p1.nextCursor);
    assert.equal(p2.items.length, 3);
    assert.equal(
      new Set([...p1.items, ...p2.items].map((n: any) => n.id)).size,
      23,
    );
  } finally {
    await app.close();
  }
});
test("failed attempts roll back delivery writes, back off, exhaust, and require authorized audited replay", async () => {
  const owner = await account(),
    type = `fixture.failures.${randomUUID()}`,
    source = await event(owner.id, type),
    queue = new PostgresConsumer(),
    store = new PostgresNotifications(),
    app = await buildApp();
  try {
    for (let i = 0; i < 5; i++) {
      await queue.once("customer-inbox-v1", [type], async (tx, e) => {
        await store.deliver(
          tx,
          e,
          notificationTemplate("booking.pending_cancelled"),
        );
        throw new Error("ISOLATED FAILURE");
      });
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int n FROM notifications.messages WHERE event_id=$1",
            [source.id],
          )
        ).rows[0].n,
        0,
      );
      if (i === 0) {
        assert.equal(
          await queue.once("customer-inbox-v1", [type], async () => {
            throw new Error("must not run");
          }),
          false,
        );
      }
      await pool.query(
        "UPDATE reporting.deliveries SET available_at=now()-interval '1 second' WHERE event_id=$1",
        [source.id],
      );
    }
    const d = (
      await pool.query(
        "SELECT state,attempts FROM reporting.deliveries WHERE event_id=$1",
        [source.id],
      )
    ).rows[0];
    assert.equal(d.state, "dead");
    assert.equal(d.attempts, 5);
    const replay = () =>
      app.inject({
        method: "POST",
        url: `/api/v1/operations/notification-deliveries/${source.id}/replay`,
        headers: owner.headers,
        payload: { reason: "Isolated failure resolved" },
      });
    assert.equal((await replay()).statusCode, 403);
    await pool.query(
      "INSERT INTO identity.grants VALUES($1,'support','platform')",
      [owner.id],
    );
    assert.equal((await replay()).statusCode, 200);
    assert.equal((await replay()).statusCode, 409);
    await queue.once("customer-inbox-v1", [type], (tx, e) =>
      store.deliver(tx, e, notificationTemplate("booking.pending_cancelled")),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM notifications.messages WHERE event_id=$1",
          [source.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE action='notifications.delivery.replay' AND target=$1",
          [source.id],
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await app.close();
  }
});
test("notification templates reject unknown events and malformed envelopes cannot persist", async () => {
  assert.throws(() => notificationTemplate("unknown"));
  const owner = await account(),
    source = await event(owner.id, `fixture.invalid.${randomUUID()}`),
    store = new PostgresNotifications();
  await assert.rejects(
    transaction((tx) =>
      store.deliver(
        tx,
        { ...source, payload: { version: 99 } },
        notificationTemplate("booking.confirmed"),
      ),
    ),
  );
});

test("Notification paging preserves microsecond boundaries and read-state changes", async () => {
  const owner = await account(),
    other = await account(),
    app = await buildApp(),
    store = new PostgresNotifications();
  try {
    for (let i = 0; i < 45; i++) {
      const source = await event(owner.id, `fixture.precision.${randomUUID()}`);
      await transaction((tx) =>
        store.deliver(tx, source, notificationTemplate("booking.confirmed")),
      );
      await pool.query(
        `UPDATE notifications.messages SET created_at='2090-01-01T12:00:00.123456Z'::timestamptz + ($2::int * interval '1 microsecond') WHERE event_id=$1`,
        [source.id, Math.floor(i / 15)],
      );
    }
    const expected = (
      await pool.query(
        "SELECT id FROM notifications.messages WHERE owner_id=$1 ORDER BY created_at DESC,id DESC",
        [owner.id],
      )
    ).rows.map((row) => row.id);
    const get = (after?: string, who = owner, unread = false) =>
      app.inject({
        method: "GET",
        url: `/api/v1/notifications?unread=${unread}${after ? `&after=${after}` : ""}`,
        headers: who.headers,
      });
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().items.length, 20);
    const { notificationPage } =
      await import("../src/modules/notifications/adapters/schemas.ts");
    notificationPage.parse(first.json());
    const boundary = first.json().nextCursor;
    // Marking the boundary read must not invalidate it for an unread traversal.
    await store.read(owner.id, boundary);
    const added = await event(owner.id, `fixture.arrival.${randomUUID()}`);
    await transaction((tx) =>
      store.deliver(tx, added, notificationTemplate("booking.confirmed")),
    );
    await pool.query(
      "UPDATE notifications.messages SET created_at='2091-01-01T00:00:00Z' WHERE event_id=$1",
      [added.id],
    );
    const second = await get(boundary);
    assert.equal(second.statusCode, 200, second.body);
    assert.equal(second.json().items.length, 20);
    const third = await get(second.json().nextCursor);
    assert.equal(third.statusCode, 200, third.body);
    assert.equal(third.json().items.length, 5);
    assert.equal(third.json().nextCursor, null);
    const actual = [first, second, third].flatMap((result) =>
      result.json().items.map((item: any) => item.id),
    );
    assert.deepEqual(actual, expected);
    assert.equal(new Set(actual).size, 45);
    const unreadSecond = await get(boundary, owner, true);
    assert.deepEqual(
      unreadSecond.json().items.map((item: any) => item.id),
      second.json().items.map((item: any) => item.id),
    );
    const latest = await get(undefined, owner, true);
    assert.ok(!latest.json().items.some((item: any) => item.id === boundary));
    assert.equal((await get(boundary, other)).statusCode, 422);
    assert.equal((await get(randomUUID())).statusCode, 422);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [owner.id],
    );
    assert.equal((await get(boundary)).statusCode, 401);
  } finally {
    await app.close();
  }
});

test("Inbox bulk read is atomic, bounded and owner scoped while new arrivals remain unread", async () => {
  const owner = await account(),
    other = await account(),
    app = await buildApp(),
    store = new PostgresNotifications();
  const deliver = async (id: string) => {
    const source = await event(id, `fixture.bulk.${randomUUID()}`);
    await transaction((tx) =>
      store.deliver(tx, source, notificationTemplate("booking.confirmed")),
    );
    return (
      await pool.query(
        "SELECT id FROM notifications.messages WHERE event_id=$1",
        [source.id],
      )
    ).rows[0].id as string;
  };
  const get = (headers = owner.headers) =>
    app.inject({ url: "/api/v1/notifications", headers });
  const bulk = (
    ids: string[],
    headers: Record<string, string> = owner.headers,
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/notifications/read",
      headers,
      payload: { ids },
    });
  try {
    for (let i = 0; i < 22; i++) await deliver(owner.id);
    const foreign = await deliver(other.id),
      page = (await get()).json(),
      ids = page.items.map((n: any) => n.id) as string[];
    assert.equal(page.unreadCount, 22);
    assert.equal(ids.length, 20);
    assert.equal((await bulk(ids, {})).statusCode, 401);
    for (const invalid of [
      [],
      Array.from({ length: 21 }, () => randomUUID()),
      [ids[0], ids[0].toUpperCase()],
    ])
      assert.equal((await bulk(invalid)).statusCode, 422);
    assert.equal((await bulk([ids[0], foreign])).statusCode, 404);
    assert.equal((await bulk([ids[0], randomUUID()])).statusCode, 404);
    assert.equal((await get()).json().unreadCount, 22);
    const initialRead = await app.inject({
      method: "POST",
      url: `/api/v1/notifications/${ids[0]}/read`,
      headers: owner.headers,
      payload: {},
    });
    const timestamp = initialRead.json().read_at;
    const arrival = await deliver(owner.id);
    const results = await Promise.all([
      bulk(ids),
      bulk([...ids].reverse()),
      bulk(ids),
    ]);
    assert(results.every((r) => r.statusCode === 200));
    assert.deepEqual(results[0].json().ids, [...ids].sort());
    assert.equal((await get()).json().unreadCount, 3);
    assert.equal((await get(other.headers)).json().unreadCount, 1);
    const rows = (
      await pool.query(
        "SELECT id,read_at FROM notifications.messages WHERE id=ANY($1::uuid[])",
        [[ids[0], arrival, foreign]],
      )
    ).rows;
    assert.equal(
      rows.find((r) => r.id === ids[0]).read_at.toISOString(),
      timestamp,
    );
    assert.equal(rows.find((r) => r.id === arrival).read_at, null);
    assert.equal(rows.find((r) => r.id === foreign).read_at, null);
    const unread = () =>
      app.inject({
        method: "DELETE",
        url: `/api/v1/notifications/${ids[0]}/read`,
        headers: owner.headers,
      });
    assert.equal((await unread()).statusCode, 200);
    assert.equal((await unread()).json().read_at, null);
    assert.equal((await get()).json().unreadCount, 4);
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/notifications/${foreign}/read`,
          headers: owner.headers,
        })
      ).statusCode,
      404,
    );
    const filtered = await app.inject({
      url: "/api/v1/notifications?unread=true",
      headers: owner.headers,
    });
    assert.equal(filtered.json().unreadCount, 4);
    assert.equal(filtered.json().items.length, 4);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [owner.id],
    );
    assert.equal((await bulk(ids)).statusCode, 401);
    assert.equal((await unread()).statusCode, 401);
  } finally {
    await app.close();
  }
});
