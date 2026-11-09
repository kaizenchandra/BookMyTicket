import { PostgresSupportBookingReader } from "../src/modules/bookings/adapters/support-reader.ts";
import { PostgresAudit } from "../src/modules/reporting/adapters/audit.ts";
import { placeFixtureOrder } from "./pricing-fixtures.ts";
import { PostgresAdmissionWindow } from "../src/modules/inventory/adapters/admission.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresProviders } from "../src/modules/providers/adapters/postgres.ts";
import {
  hashToken,
  PostgresIdentity,
} from "../src/modules/identity/adapters/postgres.ts";
import { verifyHmac } from "../src/modules/payments/adapters/razorpay.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import { buildApp } from "../src/app.ts";
if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
  throw new Error(
    "Integration tests require isolated bookmyticket_test database.",
  );
const store = new PostgresReservations(new PostgresCatalog()),
  service = new Reservations(store);
let users: string[], occurrence: string, org: string;
before(async () => {
  await migrate();
  users = Array.from({ length: 40 }, () => randomUUID());
  for (const id of users)
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, `${id}@fixture.invalid`],
    );
  org = randomUUID();
  const listing = randomUUID();
  occurrence = randomUUID();
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'TEST FIXTURE ONLY','cinema','approved')",
    [org, users[0]],
  );
  await pool.query("INSERT INTO providers.memberships VALUES($1,$2,'owner')", [
    org,
    users[0],
  ]);
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'ISOLATED TEST LISTING','movie','Test city','Test fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'TEST VENUE','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 2 hours',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  for (const id of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"])
    await pool.query(
      "INSERT INTO inventory.resources VALUES($1,$2,'seat',$2,1,0,25000,1)",
      [occurrence, id],
    );
  await pool.query(
    "INSERT INTO inventory.resources VALUES($1,'shared','pool','Shared pool',5,0,10000,1)",
    [occurrence],
  );
});
after(() => pool.end());
const items = (...ids: string[]) =>
  ids.map((resourceId) => ({
    occurrenceId: occurrence,
    resourceId,
    quantity: 1,
  }));
test("BE:INV-04/05 — 32 concurrent database requests for one seat yield exactly one hold", async () => {
  const outcomes = await Promise.allSettled(
    users
      .slice(0, 32)
      .map((u) => service.reserve(u, randomUUID(), items("A1"))),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((o) => o.status === "rejected").length, 31);
  for (const outcome of outcomes)
    if (outcome.status === "rejected")
      assert.equal(outcome.reason.code, "INVENTORY_CONFLICT");
});
test("BE:INV-07 — multi-seat conflict rolls back entire request", async () => {
  await assert.rejects(
    service.reserve(users[33], randomUUID(), items("A2", "A1")),
  );
  const result = (await service.reserve(
    users[34],
    randomUUID(),
    items("A2"),
  )) as any;
  assert.equal(result.items.length, 1);
});
test("BE:INV-10/11 — shared pool never exceeds capacity", async () => {
  const outcomes = await Promise.allSettled(
    users
      .slice(0, 15)
      .map((u) => service.reserve(u, randomUUID(), items("shared"))),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 5);
  const snapshot = await store.availability(occurrence);
  assert.equal(snapshot.resources.find((r) => r.id === "shared").available, 0);
});
test("BE:API-10/11,RSV-04 — lost response retry returns same hold and expiry; changed input conflicts", async () => {
  const key = randomUUID();
  const first = (await service.reserve(users[35], key, items("A3"))) as any;
  const retried = (await service.reserve(users[35], key, items("A3"))) as any;
  assert.equal(first.id, retried.id);
  assert.equal(first.expires_at.getTime(), retried.expires_at.getTime());
  await assert.rejects(service.reserve(users[35], key, items("A4")), {
    code: "IDEMPOTENCY_CONFLICT",
  });
});
test("BE:INV-09 — stale expiry/release cannot clear a newer ownership", async () => {
  const old = (await service.reserve(
    users[36],
    randomUUID(),
    items("A4"),
  )) as any;
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [old.id],
  );
  const fresh = (await service.reserve(
    users[37],
    randomUUID(),
    items("A4"),
  )) as any;
  await store.expire(old.id, old.version);
  await service.release(users[36], old.id);
  const current = (
    await pool.query(
      "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id=$2",
      [occurrence, "A4"],
    )
  ).rows[0];
  assert.equal(current.reservation_id, fresh.id);
});
test("BE:RSV-11 — other customer cannot retrieve or release a reservation", async () => {
  const r = (await service.reserve(
    users[38],
    randomUUID(),
    items("A5"),
  )) as any;
  await assert.rejects(service.get(users[39], r.id), { code: "NOT_FOUND" });
  await assert.rejects(service.release(users[39], r.id), { code: "NOT_FOUND" });
  assert.equal(
    ((await service.get(users[38], r.id)) as any).effective_state,
    "active",
  );
});
test("BE:INV-15 — duplicate resources and quantities rejected", async () => {
  assert.throws(
    () => service.reserve(users[39], randomUUID(), items("A6", "A6")),
    { code: "DUPLICATE_RESOURCE" },
  );
  assert.throws(
    () =>
      service.reserve(users[39], randomUUID(), [
        { occurrenceId: occurrence, resourceId: "A6", quantity: 0 },
      ]),
    { code: "INVALID_QUANTITY" },
  );
});
test("BE:SCH-06 — closed occurrence rejects reservation regardless of stale snapshot", async () => {
  await pool.query(
    "UPDATE inventory.occurrences SET state='paused' WHERE id=$1",
    [occurrence],
  );
  await assert.rejects(service.reserve(users[39], randomUUID(), items("A6")), {
    code: "SALES_CLOSED",
  });
  await pool.query(
    "UPDATE inventory.occurrences SET state='open' WHERE id=$1",
    [occurrence],
  );
});
test("BE:ACL-02 — organization membership enforced for reads/writes", async () => {
  const p = new PostgresProviders();
  await p.requireMember(users[0], org, true);
  await assert.rejects(p.requireMember(users[1], org), { code: "FORBIDDEN" });
  assert.equal((await p.list(users[1])).length, 0);
  await assert.rejects(p.submit(users[1], org, 1), { code: "FORBIDDEN" });
});
test("BE:WHK-01 — exact raw bytes and constant-time HMAC validation", () => {
  const secret = randomBytes(32).toString("hex"),
    body = Buffer.from('{"event":"payment.captured"}');
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert(verifyHmac(body, signature, secret));
  assert(!verifyHmac(Buffer.from(body + " "), signature, secret));
  assert(!verifyHmac(body, "bad", secret));
});
test("BE:IAM-06/07 — invalid OTP attempts persist and valid challenge is single use", async () => {
  const secret = randomBytes(32).toString("hex"),
    challenge = randomUUID(),
    code = "123456",
    contact = `${randomUUID()}@fixture.invalid`;
  await pool.query(
    "INSERT INTO identity.challenges(id,contact,verifier,expires_at,delivery_state) VALUES($1,$2,$3,now()+interval '5 minutes','accepted')",
    [
      challenge,
      contact,
      createHmac("sha256", secret)
        .update(`${challenge}:${contact}:${code}`)
        .digest("hex"),
    ],
  );
  const identity = new PostgresIdentity(
    {
      available: () => false,
      send: async () => {
        throw new Error("No test delivery");
      },
    },
    secret,
  );
  await assert.rejects(identity.verify(challenge, "000000"));
  assert.equal(
    (
      await pool.query("SELECT attempts FROM identity.challenges WHERE id=$1", [
        challenge,
      ])
    ).rows[0].attempts,
    1,
  );
  const result = await identity.verify(challenge, code);
  assert.equal(result.principal.contact, contact);
  await assert.rejects(identity.verify(challenge, code));
});
test("API integration — validation, auth, origin and revoked-session controls", async () => {
  const app = await buildApp();
  try {
    assert.equal((await app.inject({ url: "/ready" })).statusCode, 200);
    assert.equal(
      (await app.inject({ url: "/api/v1/profile" })).statusCode,
      401,
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/catalog?after=bad" })).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/challenges",
          headers: { origin: "https://attacker.invalid" },
          payload: { email: "test@fixture.invalid" },
        })
      ).statusCode,
      403,
    );
    const token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified) VALUES($1,$2,now()+interval '1 hour',false)",
      [hashToken(token), users[0]],
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/me", cookies: { session: token } }))
        .statusCode,
      200,
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [users[0]],
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/me", cookies: { session: token } }))
        .statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});

test("BE:BKG-09/12, FIN-01, TKT-05 — capture atomically consumes, issues tickets, posts balanced ledger and outbox once", async () => {
  const { Checkout } =
    await import("../src/modules/bookings/application/checkout.ts");
  const { PostgresBookings } =
    await import("../src/modules/bookings/adapters/postgres.ts");
  const { PostgresInventoryCommerce } =
    await import("../src/modules/inventory/adapters/commerce.ts");
  const { PostgresCaptures } =
    await import("../src/modules/payments/adapters/captures.ts");
  const { PostgresTickets } =
    await import("../src/modules/ticketing/adapters/postgres.ts");
  const { PostgresLedger } =
    await import("../src/modules/finance/adapters/postgres.ts");
  const { PostgresEvents } =
    await import("../src/modules/reporting/adapters/outbox.ts");
  const tickets = new PostgresTickets(
    new PostgresAdmissionWindow(),
    randomBytes(32).toString("hex"),
  );
  const checkout = new Checkout(
    new PostgresBookings(),
    new PostgresInventoryCommerce(new PostgresCatalog()),
    new PostgresCaptures(),
    tickets,
    new PostgresLedger(),
    new PostgresEvents(),
  );
  const hold = (await service.reserve(
    users[39],
    randomUUID(),
    items("A6"),
  )) as any;
  const order = await placeFixtureOrder(users[39], hold.id, occurrence);
  // Authoritative-capture input fixture exercises real application + database, not provider connectivity.
  const capture = {
    id: `fixture_capture_${randomUUID()}`,
    orderId: order.id,
    amountPaise: 25000,
    currency: "INR" as const,
  };
  await Promise.all(
    Array.from({ length: 10 }, () => checkout.captured(capture)),
  );
  assert.equal(
    (
      await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
        order.id,
      ])
    ).rows[0].state,
    "confirmed",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM ticketing.tickets WHERE order_id=$1",
        [order.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT sum(amount_paise)::int balance FROM finance.lines l JOIN finance.journals j ON j.id=l.journal_id WHERE j.event_id=$1",
        [capture.id],
      )
    ).rows[0].balance,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM reporting.outbox WHERE aggregate_id=$1",
        [order.id],
      )
    ).rows[0].n,
    1,
  );
  const second = { ...capture, id: `fixture_capture_${randomUUID()}` };
  const duplicate = await checkout.captured(second);
  assert.equal(duplicate.recovery, "duplicate_capture");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM payments.recovery WHERE order_id=$1",
        [order.id],
      )
    ).rows[0].n,
    1,
  );
  const issued = await tickets.list(users[39], order.id);
  const issuedToken = issued[0].token;
  assert.ok(issuedToken);
  await pool.query(
    "UPDATE inventory.occurrences SET starts_at=now()-interval '1 minute',ends_at=now()+interval '1 hour',sales_close=now()-interval '2 minutes' WHERE id=$1",
    [occurrence],
  );
  const scans = await Promise.all(
    Array.from({ length: 12 }, () =>
      tickets.admit(
        users[39],
        occurrence,
        "fixture-gate",
        issuedToken,
        randomUUID(),
      ),
    ),
  );
  assert.equal(scans.filter((r) => r.outcome === "admitted").length, 1);
  assert.equal(scans.filter((r) => r.outcome === "duplicate").length, 11);
  const previous = (
    await pool.query(
      "SELECT operation_key FROM ticketing.admissions WHERE ticket_id=$1 AND outcome='admitted'",
      [issued[0].id],
    )
  ).rows[0];
  assert.equal(
    (
      await tickets.admit(
        users[39],
        occurrence,
        "fixture-gate",
        issuedToken,
        previous.operation_key,
      )
    ).outcome,
    "admitted",
  );
  await assert.rejects(
    pool.query(
      "UPDATE finance.lines SET amount_paise=1 WHERE journal_id IN(SELECT id FROM finance.journals WHERE event_id=$1)",
      [capture.id],
    ),
  );
});
test("BE:PAY-14/15 — late capture with reassigned inventory records refund liability without displacement", async () => {
  const { Checkout } =
    await import("../src/modules/bookings/application/checkout.ts");
  const { PostgresBookings } =
    await import("../src/modules/bookings/adapters/postgres.ts");
  const { PostgresInventoryCommerce } =
    await import("../src/modules/inventory/adapters/commerce.ts");
  const { PostgresCaptures } =
    await import("../src/modules/payments/adapters/captures.ts");
  const { PostgresTickets } =
    await import("../src/modules/ticketing/adapters/postgres.ts");
  const { PostgresLedger } =
    await import("../src/modules/finance/adapters/postgres.ts");
  const { PostgresEvents } =
    await import("../src/modules/reporting/adapters/outbox.ts");
  const checkout = new Checkout(
    new PostgresBookings(),
    new PostgresInventoryCommerce(new PostgresCatalog()),
    new PostgresCaptures(),
    new PostgresTickets(
      new PostgresAdmissionWindow(),
      randomBytes(32).toString("hex"),
    ),
    new PostgresLedger(),
    new PostgresEvents(),
  );
  await pool.query(
    "UPDATE inventory.occurrences SET starts_at=now()+interval '2 days',ends_at=now()+interval '2 days 2 hours',sales_close=now()+interval '1 day' WHERE id=$1",
    [occurrence],
  );
  const old = (await service.reserve(
    users[36],
    randomUUID(),
    items("A7"),
  )) as any;
  const order = await placeFixtureOrder(users[36], old.id, occurrence);
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [old.id],
  );
  const fresh = (await service.reserve(
    users[37],
    randomUUID(),
    items("A7"),
  )) as any;
  const result = await checkout.captured({
    id: `fixture_capture_${randomUUID()}`,
    orderId: order.id,
    amountPaise: 25000,
    currency: "INR",
  });
  assert.equal(result.state, "refund_required");
  assert.equal(
    (
      await pool.query(
        "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id='A7'",
        [occurrence],
      )
    ).rows[0].reservation_id,
    fresh.id,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM ticketing.tickets WHERE order_id=$1",
        [order.id],
      )
    ).rows[0].n,
    0,
  );
});

test("BE:CAT-12 — unpublished catalog never exposes occurrence inventory", async () => {
  const row = (
    await pool.query(
      "SELECT listing_id FROM inventory.occurrences WHERE id=$1",
      [occurrence],
    )
  ).rows[0];
  await pool.query(
    "UPDATE catalog.listings SET state='suspended',version=version+1 WHERE id=$1",
    [row.listing_id],
  );
  await assert.rejects(store.availability(occurrence), { code: "NOT_FOUND" });
  await assert.rejects(service.reserve(users[39], randomUUID(), items("A8")), {
    code: "NOT_FOUND",
  });
  await pool.query(
    "UPDATE catalog.listings SET state='published',version=version+1 WHERE id=$1",
    [row.listing_id],
  );
});
test("BE:SUP-03 — customer case isolation and internal-note protection", async () => {
  const { PostgresCases } =
    await import("../src/modules/support/adapters/postgres.ts");
  const cases = new PostgresCases(
    new PostgresAudit(),
    new PostgresSupportBookingReader(),
  );
  const c = (await cases.create(
    users[1],
    "TEST FIXTURE CASE",
    "booking",
    "An isolated integration test case",
  )) as { id: string };
  await cases.reply(users[2], c.id, "Internal fixture note", "internal", true);
  assert.equal((await cases.messages(users[1], c.id, false)).items.length, 1);
  assert.equal((await cases.messages(users[2], c.id, true)).items.length, 2);
  await assert.rejects(cases.messages(users[3], c.id, false), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    cases.reply(users[1], c.id, "Forbidden note", "internal", false),
    { code: "FORBIDDEN" },
  );
});

test("Expiry workers preserve replacement holds and safely share batches", async () => {
  const { PostgresReservationExpiry } =
    await import("../src/modules/inventory/adapters/expiry.ts");
  const seat = "expiry-" + randomUUID();
  await pool.query(
    "INSERT INTO inventory.resources VALUES($1,$2,'seat',$2,1,0,25000,1)",
    [occurrence, seat],
  );
  const owner = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  const old = (await service.reserve(owner, randomUUID(), items(seat))) as any;
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [old.id],
  );
  const fresh = (await service.reserve(
    owner,
    randomUUID(),
    items(seat),
  )) as any;
  const worker = new PostgresReservationExpiry();
  await Promise.all([worker.expireBatch(1000), worker.expireBatch(1000)]);
  assert.equal(
    (
      await pool.query(
        "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id=$2",
        [occurrence, seat],
      )
    ).rows[0].reservation_id,
    fresh.id,
  );
  assert.equal(
    (
      await pool.query("SELECT state FROM inventory.reservations WHERE id=$1", [
        old.id,
      ])
    ).rows[0].state,
    "expired",
  );
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [fresh.id],
  );
  await Promise.all([worker.expireBatch(1000), worker.expireBatch(1000)]);
  assert.equal(
    (
      await pool.query(
        "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id=$2",
        [occurrence, seat],
      )
    ).rows[0].reservation_id,
    null,
  );
});
