import { walletResponse } from "../src/modules/bookings/adapters/wallet-schema.ts";
import { quoteResponseSchema } from "../src/modules/pricing/adapters/schemas.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import {
  assignFixturePolicy,
  fixturePolicy,
  policies,
} from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.EXPORT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const c = commerce(),
  reservations = new Reservations(
    new PostgresReservations(new PostgresCatalog()),
  );
async function fixture(approvedPolicy = true) {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'PRICING TEST ONLY','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'PRICING TEST ONLY','event','Test city','Isolated fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'Pricing fixture venue','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool','pool','TEST POOL',20,101)",
    [occurrence],
  );
  const policyId = approvedPolicy
    ? await assignFixturePolicy(owner, occurrence, {
        ...fixturePolicy,
        feePerOrderPaise: 5,
        ticketTax: { basisPoints: 500, mode: "exclusive" },
      })
    : null;
  const hold = (await reservations.reserve(owner, randomUUID(), [
    { occurrenceId: occurrence, resourceId: "pool", quantity: 3 },
  ])) as any;
  return { owner, org, listing, occurrence, policyId, hold };
}

async function prepared() {
  const f = await fixture(),
    quote = await c.quotes.create(f.owner, f.hold.id);
  const order = (await c.placement.accept(f.owner, randomUUID(), {
    reservationId: f.hold.id,
    quoteId: quote.id,
    acceptPolicies: true,
  })) as any;
  const preview = await c.pendingCancellation.preview(f.owner, order.id);
  return {
    ...f,
    order,
    preview,
    input: {
      previewId: preview.previewId!,
      reason: "Customer changed their plans",
      acknowledgePaymentRisk: true,
    },
  };
}

test("pending cancellation is atomic, idempotent, releases capacity and persists one durable event", async () => {
  const f = await prepared();
  await pool.query(
    "UPDATE inventory.resources SET capacity=3 WHERE occurrence_id=$1",
    [f.occurrence],
  );
  const key = randomUUID(),
    results = await Promise.all(
      Array.from({ length: 8 }, () =>
        c.pendingCancellation.cancel(f.owner, f.order.id, key, f.input),
      ),
    );
  assert.ok(results.every((r: any) => r.bookingState === "cancelled"));
  assert.deepEqual(results[0], results[1]);
  await assert.rejects(
    c.pendingCancellation.cancel(f.owner, f.order.id, key, {
      ...f.input,
      reason: "Changed cancellation reason",
    }),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  assert.equal(
    (
      await pool.query("SELECT state FROM inventory.reservations WHERE id=$1", [
        f.hold.id,
      ])
    ).rows[0].state,
    "released",
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM reporting.outbox WHERE aggregate_id=$1 AND type='booking.pending_cancelled'",
        [f.order.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM bookings.pending_cancellations WHERE order_id=$1",
        [f.order.id],
      )
    ).rows[0].n,
    1,
  );
  const replacement = await reservations.reserve(f.owner, randomUUID(), [
    { occurrenceId: f.occurrence, resourceId: "pool", quantity: 3 },
  ]);
  assert.ok(replacement);
  await assert.rejects(
    c.paymentOrders.prepare(f.owner, f.order.id, async () => undefined),
    { code: "PAYMENT_NOT_ALLOWED" },
  );
});
test("stale preview, missing acknowledgment and cross-account cancellation are rejected", async () => {
  const f = await prepared();
  await assert.rejects(
    c.pendingCancellation.preview(randomUUID(), f.order.id),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    c.pendingCancellation.cancel(
      randomUUID(),
      f.order.id,
      randomUUID(),
      f.input,
    ),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), {
      ...f.input,
      acknowledgePaymentRisk: false,
    }),
    { code: "INVALID_CANCELLATION" },
  );
  await pool.query(
    "UPDATE bookings.pending_cancel_previews SET expires_at=now()-interval '1 second' WHERE order_id=$1",
    [f.order.id],
  );
  await assert.rejects(
    c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), f.input),
    { code: "CANCELLATION_PREVIEW_CHANGED" },
  );
  assert.equal(
    (await c.bookings.get(f.owner, f.order.id)).state,
    "pending_payment",
  );
});
test("payment initiation after preview requires renewed risk acknowledgment", async () => {
  const { PostgresCollection } =
    await import("../src/modules/payments/adapters/collection.ts");
  const f = await prepared();
  await c.paymentOrders.prepare(f.owner, f.order.id, (tx, order) =>
    new PostgresCollection().prepare(tx, order.id, order.amount_paise),
  );
  await assert.rejects(
    c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), f.input),
    { code: "CANCELLATION_PREVIEW_CHANGED" },
  );
  const preview = await c.pendingCancellation.preview(f.owner, f.order.id);
  assert.equal(preview.paymentActivity, true);
  assert.notEqual(preview.previewId, f.preview.previewId);
  await c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), {
    ...f.input,
    previewId: preview.previewId!,
  });
});
test("late successful capture after cancellation records a refund obligation and cannot resurrect booking", async () => {
  const f = await prepared(),
    key = randomUUID();
  await c.pendingCancellation.cancel(f.owner, f.order.id, key, f.input);
  // Trusted capture fixture exercises real recovery/ledger components, not provider connectivity.
  const payment = {
    id: "fixture_cancel_" + randomUUID(),
    orderId: f.order.id,
    amountPaise: f.order.amount_paise,
    currency: "INR" as const,
  };
  const result = await c.checkout.captured(payment);
  assert.equal(result.state, "cancelled");
  await c.checkout.captured(payment);
  assert.equal((await c.bookings.get(f.owner, f.order.id)).state, "cancelled");
  assert.equal((await c.tickets.list(f.owner, f.order.id)).length, 0);
  const status = await c.pendingCancellation.preview(f.owner, f.order.id);
  assert.equal(status.recovery.length, 1);
  assert.equal(status.recovery[0].amountPaise, f.order.amount_paise);
  assert.equal(status.recovery[0].state, "review_required");
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM finance.journals WHERE event_id=$1",
        [payment.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      (await c.pendingCancellation.cancel(
        f.owner,
        f.order.id,
        key,
        f.input,
      )) as any
    ).bookingState,
    "cancelled",
  );
});
test("capture versus cancellation has one outcome and never both sold inventory and a cancelled pending order", async () => {
  for (let i = 0; i < 6; i++) {
    const f = await prepared();
    await Promise.allSettled([
      c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), f.input),
      c.checkout.captured({
        id: "fixture_race_" + randomUUID(),
        orderId: f.order.id,
        amountPaise: f.order.amount_paise,
        currency: "INR",
      }),
    ]);
    const order = await c.bookings.get(f.owner, f.order.id),
      sold = (
        await pool.query(
          "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
          [f.occurrence],
        )
      ).rows[0].sold;
    assert.ok(["confirmed", "cancelled"].includes(order.state));
    assert.equal(sold, order.state === "confirmed" ? 3 : 0);
    assert.equal(
      (await c.tickets.list(f.owner, f.order.id)).length,
      order.state === "confirmed" ? 3 : 0,
    );
  }
});
test("releasing an expired seat hold preserves its new reservation owner", async () => {
  const f = await prepared();
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'chair','seat','Fixture chair',1,101)",
    [f.occurrence],
  );
  const hold = (await reservations.reserve(f.owner, randomUUID(), [
      { occurrenceId: f.occurrence, resourceId: "chair", quantity: 1 },
    ])) as any,
    quote = await c.quotes.create(f.owner, hold.id),
    order = (await c.placement.accept(f.owner, randomUUID(), {
      reservationId: hold.id,
      quoteId: quote.id,
      acceptPolicies: true,
    })) as any;
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 second' WHERE id=$1",
    [hold.id],
  );
  const replacement = (await reservations.reserve(f.owner, randomUUID(), [
      { occurrenceId: f.occurrence, resourceId: "chair", quantity: 1 },
    ])) as any,
    preview = await c.pendingCancellation.preview(f.owner, order.id);
  await c.pendingCancellation.cancel(f.owner, order.id, randomUUID(), {
    ...f.input,
    previewId: preview.previewId!,
  });
  assert.equal(
    (
      await pool.query(
        "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id='chair'",
        [f.occurrence],
      )
    ).rows[0].reservation_id,
    replacement.id,
  );
});
test("HTTP preview/cancel enforces ownership and records only server-validated cancellation", async () => {
  const f = await prepared(),
    token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), f.owner],
  );
  const app = await buildApp();
  try {
    const url = `/api/v1/bookings/${f.order.id}/pending-cancellation`,
      headers = {
        cookie: `session=${token}`,
        origin: "http://localhost:3000",
        "idempotency-key": randomUUID(),
      };
    assert.equal(
      (await app.inject({ method: "POST", url, payload: f.input })).statusCode,
      401,
    );
    const preview = await app.inject({
      method: "POST",
      url: url + "/preview",
      headers,
      payload: {},
    });
    assert.equal(preview.statusCode, 200, preview.body);
    const response = await app.inject({
      method: "POST",
      url,
      headers,
      payload: { ...f.input, previewId: preview.json().previewId },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().bookingState, "cancelled");
    assert.equal(response.json().refundStatus, "not_confirmed");
  } finally {
    await app.close();
  }
});

test("an inconsistent consumed hold rolls back cancellation, command, audit and outbox writes", async () => {
  const f = await prepared();
  await pool.query(
    "UPDATE inventory.reservations SET state='consumed' WHERE id=$1",
    [f.hold.id],
  );
  await assert.rejects(
    c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), f.input),
    { code: "ALREADY_CONSUMED" },
  );
  assert.equal(
    (await c.bookings.get(f.owner, f.order.id)).state,
    "pending_payment",
  );
  for (const table of ["pending_cancellations", "pending_cancel_commands"])
    assert.equal(
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM bookings.${table} WHERE order_id=$1`,
          [f.order.id],
        )
      ).rows[0].n,
      0,
    );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM reporting.outbox WHERE aggregate_id=$1 AND type='booking.pending_cancelled'",
        [f.order.id],
      )
    ).rows[0].n,
    0,
  );
});
