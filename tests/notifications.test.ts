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
