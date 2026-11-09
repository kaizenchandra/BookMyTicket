import { historyPage } from "../src/modules/bookings/adapters/history-schema.ts";
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
async function actor() {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), id],
  );
  return { id, headers: { cookie: `session=${token}` } };
}
async function order(
  owner: string,
  state = "confirmed",
  endsAt = new Date(Date.now() + 86400000).toISOString(),
  title?: string,
) {
  const id = randomUUID(),
    reservation = randomUUID();
  await pool.query(
    "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1::uuid,$2,$1::text,'fixture','consumed',now())",
    [reservation, owner],
  );
  await pool.query(
    "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at) VALUES($1,$2,$3,0,'INR','isolated-fixture',$4,$5,'2026-10-01T00:00:00.123456Z')",
    [
      id,
      owner,
      reservation,
      state,
      {
        occurrences: [
          {
            id: randomUUID(),
            title,
            startsAt: "2026-01-01T00:00:00Z",
            endsAt,
            timeZone: "Asia/Kolkata",
            venueName: "Isolated fixture venue",
          },
        ],
      },
    ],
  );
  return id;
}
test("Booking history has owner-scoped microsecond-safe pagination and strict filters", async () => {
  const app = await buildApp(),
    owner = await actor(),
    stranger = await actor();
  const read = (p: Record<string, string> = {}, who = owner) =>
    app.inject({
      method: "GET",
      url: `/api/v1/bookings?${new URLSearchParams(p)}`,
      headers: who.headers,
    });
  try {
    for (let i = 0; i < 28; i++)
      await order(owner.id, undefined, undefined, "ISOLATED Shared title");
    await order(stranger.id, undefined, undefined, "ISOLATED Shared title");
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/v1/bookings" })).statusCode,
      401,
    );
    const firstResponse = await read({ q: "shared TITLE" });
    assert.equal(firstResponse.statusCode, 200, firstResponse.body);
    const first = historyPage.parse(firstResponse.json());
    assert.equal(first.items.length, 25);
    assert.ok(first.nextCursor);
    assert.equal(firstResponse.headers["cache-control"], "no-store");
    assert.ok(
      first.items.every(
        (b: any) => b.snapshot === undefined && b.owner_id === undefined,
      ),
    );
    const second = (
      await read({ q: "shared TITLE", after: first.nextCursor })
    ).json();
    assert.equal(second.items.length, 3);
    assert.equal(
      new Set([...first.items, ...second.items].map((b) => b.id)).size,
      28,
    );
    assert.equal(second.nextCursor, null);
    assert.equal(
      (await read({ q: "shared TITLE", after: first.nextCursor }, stranger))
        .statusCode,
      422,
    );
    assert.equal(
      (await read({ q: "different", after: first.nextCursor })).statusCode,
      422,
    );
    assert.equal((await read({ state: "fake" })).statusCode, 422);
    assert.equal((await read({ after: "broken" })).statusCode, 422);
    assert.equal((await read({ owner: owner.id })).statusCode, 422);
    assert.equal(
      (
        await read({
          from: "2026-10-02T00:00:00Z",
          until: "2026-10-01T00:00:00Z",
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (await read({ from: "2026-10-01T05:30:01+05:30" })).json().items.length,
      0,
    );
    assert.equal(
      (await read({ until: "2026-10-01T00:00:00Z" })).json().items.length,
      0,
    );
    assert.equal((await read({}, stranger)).json().items.length, 1);
    assert.equal(
      (await read({ q: first.items[0].id.slice(0, 12) })).json().items[0].id,
      first.items[0].id,
    );
  } finally {
    await app.close();
  }
});
test("Booking timing uses confirmed saved sessions and literal wildcard search", async () => {
  const app = await buildApp(),
    owner = await actor();
  const read = async (p: Record<string, string>) => {
    const r = await app.inject({
      method: "GET",
      url: `/api/v1/bookings?${new URLSearchParams(p)}`,
      headers: owner.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  try {
    const past = await order(
        owner.id,
        "confirmed",
        new Date(Date.now() - 60000).toISOString(),
        "100%_saved",
      ),
      future = await order(owner.id, "confirmed", undefined, "Future");
    await order(owner.id, "pending_payment", undefined, "Pending");
    await order(owner.id, "cancelled", undefined);
    await order(owner.id, "refund_required", undefined);
    assert.deepEqual(
      (await read({ period: "past" })).items.map((b: any) => b.id),
      [past],
    );
    assert.deepEqual(
      (await read({ period: "upcoming" })).items.map((b: any) => b.id),
      [future],
    );
    assert.equal((await read({ q: "%_" })).items.length, 1);
    assert.equal((await read({ state: "cancelled" })).items.length, 1);
    assert.equal(
      (await read({ state: "pending_payment", period: "past" })).items.length,
      0,
    );
    assert.equal((await read({ state: "refund_required" })).items.length, 1);
  } finally {
    await app.close();
  }
});

test("Support cases link only owned bookings and staff receive limited live context", async () => {
  const app = await buildApp(),
    owner = await actor(),
    stranger = await actor(),
    staff = await actor();
  try {
    const booking = await order(
      owner.id,
      "pending_payment",
      undefined,
      "Private fixture title",
    );
    await pool.query(
      "INSERT INTO identity.grants VALUES($1,'support','platform')",
      [staff.id],
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=now() WHERE account_id=$1",
      [staff.id],
    );
    const payload = {
      subject: "ISOLATED LINKED CASE",
      category: "payment",
      body: "Please investigate this booking.",
      bookingId: booking as string,
    };
    const create = (who = owner, body = payload) =>
      app.inject({
        method: "POST",
        url: "/api/v1/cases",
        headers: who.headers,
        payload: body,
      });
    assert.equal((await create(stranger)).statusCode, 404);
    assert.equal(
      (await create(owner, { ...payload, bookingId: randomUUID() })).statusCode,
      404,
    );
    assert.equal(
      (await create(owner, { ...payload, bookingId: "not-a-uuid" })).statusCode,
      422,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM support.cases WHERE owner_id=$1",
          [stranger.id],
        )
      ).rows[0].n,
      0,
    );
    const created = await create();
    assert.equal(created.statusCode, 200, created.body);
    const id = created.json().id;
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/cases",
      headers: owner.headers,
    });
    assert.equal(list.json().items[0].booking_id, booking);
    const detail = () =>
      app.inject({
        method: "GET",
        url: `/api/v1/operations/cases/${id}`,
        headers: staff.headers,
      });
    const first = await detail();
    assert.equal(first.statusCode, 200, first.body);
    assert.deepEqual(Object.keys(first.json().booking).sort(), [
      "amountPaise",
      "createdAt",
      "currency",
      "id",
      "state",
    ]);
    assert.equal(first.json().booking.state, "pending_payment");
    await pool.query(
      "UPDATE bookings.orders SET state='cancelled' WHERE id=$1",
      [booking],
    );
    assert.equal((await detail()).json().booking.state, "cancelled");
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/operations/cases/${id}`,
          headers: owner.headers,
        })
      ).statusCode,
      403,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      staff.id,
    ]);
    assert.equal((await detail()).statusCode, 403);
  } finally {
    await app.close();
  }
});
