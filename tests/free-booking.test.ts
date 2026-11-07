import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import { assignFixturePolicy, fixturePolicy } from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { freeConfirmationResponse } from "../src/modules/bookings/adapters/free-schema.ts";
import { paymentStatusSchema } from "../src/modules/payments/adapters/schemas.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("hex");
before(migrate);
after(() => pool.end());
async function fixture(price = 0, eligible = true) {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'FREE FIXTURE','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'FREE FIXTURE','event','Test city','Isolated free booking fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'FREE FIXTURE','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool','pool','FIXTURE POOL',2,$2)",
    [occurrence, price],
  );
  await assignFixturePolicy(owner, occurrence, {
    ...fixturePolicy,
    allowFreeBookings: eligible,
  });
  const c = commerce(),
    reservations = new Reservations(
      new PostgresReservations(new PostgresCatalog()),
    ),
    hold = (await reservations.reserve(owner, randomUUID(), [
      { occurrenceId: occurrence, resourceId: "pool", quantity: 2 },
    ])) as any;
  return {
    owner,
    occurrence,
    hold,
    c,
    headers: { cookie: `session=${token}` },
  };
}
async function prepared(price = 0) {
  const f = await fixture(price),
    quote = await f.c.quotes.create(f.owner, f.hold.id),
    order = (await f.c.placement.accept(f.owner, randomUUID(), {
      reservationId: f.hold.id,
      quoteId: quote.id,
      acceptPolicies: true,
    })) as any;
  return { ...f, order };
}
test("free HTTP confirmation is idempotent, issues tickets once, and never invents payment", async () => {
  const f = await prepared(),
    app = await buildApp();
  try {
    const key = randomUUID(),
      confirm = (k = key) =>
        app.inject({
          method: "POST",
          url: `/api/v1/bookings/${f.order.id}/free-confirmation`,
          headers: { ...f.headers, "idempotency-key": k },
          payload: { confirm: true },
        });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => confirm()),
    );
    for (const result of results) {
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(
        freeConfirmationResponse.parse(result.json()).bookingState,
        "confirmed",
      );
    }
    assert.equal((await confirm(randomUUID())).statusCode, 200);
    const saved = (
      await pool.query(
        "SELECT state,confirmed_payment_id FROM bookings.orders WHERE id=$1",
        [f.order.id],
      )
    ).rows[0];
    assert.equal(saved.confirmed_payment_id, null);
    assert.equal(saved.state, "confirmed");
    assert.equal(
      (
        await pool.query(
          "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
          [f.occurrence],
        )
      ).rows[0].sold,
      2,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM ticketing.tickets WHERE order_id=$1",
          [f.order.id],
        )
      ).rows[0].n,
      2,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM payments.captures WHERE order_id=$1",
          [f.order.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM payments.provider_orders WHERE order_id=$1",
          [f.order.id],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.outbox WHERE aggregate_id=$1 AND type='booking.confirmed'",
          [f.order.id],
        )
      ).rows[0].n,
      1,
    );
    const wallet = await app.inject({
      method: "GET",
      url: `/api/v1/bookings/${f.order.id}/tickets`,
      headers: f.headers,
    });
    assert.equal(wallet.statusCode, 200);
    assert.equal(wallet.json().items.length, 2);
    assert.ok(wallet.json().items.every((i: any) => i.qrSvg));
    const status = paymentStatusSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/bookings/${f.order.id}/payment`,
          headers: f.headers,
        })
      ).json(),
    );
    assert.equal(status.paymentState, "not_required");
    assert.equal(status.allowedActions.initiate, false);
    const another = await prepared();
    await assert.rejects(
      f.c.freeConfirmation.confirm(another.owner, f.order.id, randomUUID()),
      { code: "NOT_FOUND" },
    );
    await assert.rejects(
      f.c.freeConfirmation.confirm(f.owner, another.order.id, key),
      { code: "IDEMPOTENCY_CONFLICT" },
    );
  } finally {
    await app.close();
  }
});
test("free confirmation rejects paid orders, missing eligibility, expired holds and closed sales", async () => {
  const paid = await prepared(100);
  await assert.rejects(
    paid.c.freeConfirmation.confirm(paid.owner, paid.order.id, randomUUID()),
    { code: "PAYMENT_REQUIRED" },
  );
  const disabled = await fixture(0, false);
  await assert.rejects(
    disabled.c.quotes.create(disabled.owner, disabled.hold.id),
    { code: "FREE_BOOKING_NOT_ALLOWED" },
  );
  const expired = await prepared();
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired.hold.id],
  );
  await assert.rejects(
    expired.c.freeConfirmation.confirm(
      expired.owner,
      expired.order.id,
      randomUUID(),
    ),
    { code: "RESERVATION_EXPIRED" },
  );
  const paused = await prepared();
  await pool.query(
    "UPDATE inventory.occurrences SET state='paused' WHERE id=$1",
    [paused.occurrence],
  );
  await assert.rejects(
    paused.c.freeConfirmation.confirm(
      paused.owner,
      paused.order.id,
      randomUUID(),
    ),
    { code: "SALES_CLOSED" },
  );
});
test("ticket configuration failure rolls inventory and booking back, then a retry can succeed", async () => {
  const f = await prepared(),
    original = process.env.TICKET_ENCRYPTION_KEY;
  try {
    process.env.TICKET_ENCRYPTION_KEY = "";
    const unavailable = commerce();
    await assert.rejects(
      unavailable.freeConfirmation.confirm(f.owner, f.order.id, randomUUID()),
      { code: "TICKETING_UNAVAILABLE" },
    );
    assert.equal(
      (
        await pool.query(
          "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
          [f.occurrence],
        )
      ).rows[0].sold,
      0,
    );
    assert.equal(
      (
        await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
          f.order.id,
        ])
      ).rows[0].state,
      "pending_payment",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM bookings.free_confirmations WHERE order_id=$1",
          [f.order.id],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    process.env.TICKET_ENCRYPTION_KEY = original;
  }
  assert.equal(
    (await f.c.freeConfirmation.confirm(f.owner, f.order.id, randomUUID()))
      .bookingState,
    "confirmed",
  );
});
test("cancellation racing free confirmation produces one terminal outcome and consistent inventory", async () => {
  const f = await prepared(),
    preview = await f.c.pendingCancellation.preview(f.owner, f.order.id);
  await Promise.allSettled([
    f.c.freeConfirmation.confirm(f.owner, f.order.id, randomUUID()),
    f.c.pendingCancellation.cancel(f.owner, f.order.id, randomUUID(), {
      previewId: preview.previewId!,
      reason: "ISOLATED CANCELLATION RACE",
      acknowledgePaymentRisk: true,
    }),
  ]);
  const order = (
      await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
        f.order.id,
      ])
    ).rows[0],
    sold = (
      await pool.query(
        "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
        [f.occurrence],
      )
    ).rows[0].sold,
    tickets = (
      await pool.query(
        "SELECT count(*)::int n FROM ticketing.tickets WHERE order_id=$1",
        [f.order.id],
      )
    ).rows[0].n;
  assert.ok(["confirmed", "cancelled"].includes(order.state));
  assert.equal(sold, order.state === "confirmed" ? 2 : 0);
  assert.equal(tickets, sold);
});
