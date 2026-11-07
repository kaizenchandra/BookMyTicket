import { paymentStatusSchema } from "../src/modules/payments/adapters/schemas.ts";
// All records below are isolated database fixtures, never evidence of Razorpay connectivity.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool, transaction } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import { PostgresCollection } from "../src/modules/payments/adapters/collection.ts";
import { assignFixturePolicy, fixturePolicy } from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
const c = commerce(),
  store = new PostgresCollection();
async function fixture() {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'PAYMENT FIXTURE','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'PAYMENT FIXTURE','event','Test city','Isolated fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'FIXTURE','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool','pool','FIXTURE',20,25000)",
    [occurrence],
  );
  await assignFixturePolicy(owner, occurrence);
  const hold = (await new Reservations(
    new PostgresReservations(new PostgresCatalog()),
  ).reserve(owner, randomUUID(), [
    { occurrenceId: occurrence, resourceId: "pool", quantity: 1 },
  ])) as any;
  const quote = await c.quotes.create(owner, hold.id);
  const order = (await c.placement.accept(owner, randomUUID(), {
    reservationId: hold.id,
    quoteId: quote.id,
    acceptPolicies: true,
  })) as any;
  return { owner, occurrence, hold, order };
}
const stage = (f: Awaited<ReturnType<typeof fixture>>) =>
  c.paymentOrders.prepare(f.owner, f.order.id, (tx, o) =>
    store.prepare(tx, o.id, o.amount_paise),
  );
test("BE:PAY-04/05 — concurrent initiation commits exactly one trusted intent", async () => {
  const f = await fixture();
  const outcomes = await Promise.all(
    Array.from({ length: 16 }, () => stage(f)),
  );
  assert.equal(outcomes.filter((r) => r.newAttempt).length, 1);
  assert(
    outcomes.every((r) => r.amount_paise === 25000 && r.state === "creating"),
  );
  assert.equal(
    (
      await pool.query(
        "SELECT expires_at FROM inventory.reservations WHERE id=$1",
        [f.hold.id],
      )
    ).rows[0].expires_at.getTime(),
    f.hold.expires_at.getTime(),
  );
});
test("BE:PRC-08 — changed policy prevents payment intent persistence", async () => {
  const f = await fixture();
  await assignFixturePolicy(f.owner, f.occurrence, {
    ...fixturePolicy,
    feePerOrderPaise: 100,
  });
  await assert.rejects(stage(f), { code: "QUOTE_CHANGED" });
  assert.equal(await store.get(f.order.id), undefined);
});
test("BE:RSV-03 — expired hold blocks payment without worker cleanup", async () => {
  const f = await fixture();
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 second' WHERE id=$1",
    [f.hold.id],
  );
  await assert.rejects(stage(f), { code: "RESERVATION_EXPIRED" });
  assert.equal(await store.get(f.order.id), undefined);
});
test("BE:ACL-01 — payment preparation and status reject another owner", async () => {
  const f = await fixture();
  await assert.rejects(
    c.paymentOrders.prepare(randomUUID(), f.order.id, async () => {}),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(c.collection.status(randomUUID(), f.order.id), {
    code: "NOT_FOUND",
  });
});
test("BE:PAY-10 — unknown outcomes do not erase resolved mappings", async () => {
  const f = await fixture();
  await stage(f);
  await store.unknown(f.order.id);
  assert.equal((await store.get(f.order.id)).state, "unknown");
  const id = "order_" + randomBytes(8).toString("hex");
  await store.created(f.order.id, id);
  await store.unknown(f.order.id);
  assert.equal((await store.get(f.order.id)).provider_id, id);
  assert.equal((await store.get(f.order.id)).state, "ready");
  await assert.rejects(store.created(f.order.id, "order_other"), {
    code: "PROVIDER_MISMATCH",
  });
});
test("BE:WHK-06 — stale observations cannot regress captured/refunded states or change associations", async () => {
  const f = await fixture(),
    other = await fixture();
  await stage(f);
  await stage(other);
  const payment = {
    id: "pay_" + randomBytes(8).toString("hex"),
    order_id: "order_fixture",
    amount: 25000,
    currency: "INR",
    status: "captured",
  };
  assert.equal(await store.observe(f.order.id, payment), "captured");
  assert.equal(
    await store.observe(f.order.id, { ...payment, status: "authorized" }),
    "captured",
  );
  assert.equal(
    await store.observe(f.order.id, { ...payment, status: "refunded" }),
    "refunded",
  );
  assert.equal(await store.observe(f.order.id, payment), "refunded");
  await assert.rejects(store.observe(other.order.id, payment), {
    code: "PROVIDER_MISMATCH",
  });
});
test("BE:PAY-13 — retry claims require failed observations and serialize concurrent reopen requests", async () => {
  const f = await fixture();
  await stage(f);
  await store.created(f.order.id, "order_" + randomBytes(8).toString("hex"));
  await assert.rejects(
    transaction((tx) => store.claimRetry(tx, f.order.id)),
    { code: "PAYMENT_RECONCILING" },
  );
  await store.observe(f.order.id, {
    id: "pay_" + randomBytes(8).toString("hex"),
    order_id: "order_fixture",
    amount: 25000,
    currency: "INR",
    status: "failed",
  });
  const outcomes = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      transaction((tx) => store.claimRetry(tx, f.order.id)),
    ),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  assert.equal((await store.get(f.order.id)).retry_eligible, false);
});
test("HTTP payments enforce authentication, ownership, strict input and invalid signature rejection", async () => {
  const f = await fixture(),
    token = randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), f.owner],
  );
  const app = await buildApp();
  try {
    const path = `/api/v1/bookings/${f.order.id}/payment`,
      headers = { cookie: `session=${token}` };
    assert.equal(
      (await app.inject({ method: "GET", url: path })).statusCode,
      401,
    );
    const status = await app.inject({ method: "GET", url: path, headers });
    assert.equal(status.statusCode, 200);
    paymentStatusSchema.parse(status.json());
    assert.equal(status.json().paymentState, "not_started");
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path,
          headers,
          payload: { amount: 1 },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/callback",
          headers,
          payload: {
            providerOrderId: "order_fixture",
            paymentId: "pay_fixture",
            signature: "0".repeat(64),
          },
        })
      ).json().code,
      "INVALID_PAYMENT_SIGNATURE",
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/bookings/${randomUUID()}/payment`,
          headers,
        })
      ).statusCode,
      404,
    );
    assert.equal(await store.get(f.order.id), undefined);
  } finally {
    await app.close();
  }
});

test("Customer recovery requests persist once under concurrency and preserve worker leases, backoff and review", async () => {
  const f = await fixture();
  await stage(f);
  await store.created(f.order.id, "order_" + randomBytes(8).toString("hex"));
  const results = await Promise.all(
    Array.from({ length: 12 }, () => store.requestRecovery(f.order.id)),
  );
  assert.equal(results.filter((x) => x.state === "queued").length, 1);
  const row = await store.get(f.order.id);
  assert(row.recovery_requested_at);
  await pool.query(
    "UPDATE payments.provider_orders SET recovery_requested_at=NULL,lease_until=clock_timestamp()+interval '1 minute',lease_token=$2,available_at=clock_timestamp()+interval '1 hour' WHERE order_id=$1",
    [f.order.id, randomUUID()],
  );
  const before = await store.get(f.order.id);
  assert.equal((await store.requestRecovery(f.order.id)).state, "pending");
  assert.equal(
    (await store.get(f.order.id)).available_at.getTime(),
    before.available_at.getTime(),
  );
  await pool.query(
    "UPDATE payments.provider_orders SET lease_until=NULL,failures=2 WHERE order_id=$1",
    [f.order.id],
  );
  assert.equal((await store.requestRecovery(f.order.id)).state, "pending");
  await pool.query(
    "UPDATE payments.provider_orders SET review_required=true WHERE order_id=$1",
    [f.order.id],
  );
  await assert.rejects(store.requestRecovery(f.order.id), {
    code: "PAYMENT_REVIEW_REQUIRED",
  });
  await assert.rejects(c.collection.requestRecovery(randomUUID(), f.order.id), {
    code: "NOT_FOUND",
  });
});

test("Raw signed webhook HTTP ingestion rejects malformed content, deduplicates deliveries and detects reused IDs", async () => {
  const { createHmac } = await import("node:crypto");
  const original = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = randomBytes(32).toString("hex");
  const app = await buildApp(),
    eventId = "evt_" + randomBytes(12).toString("hex");
  const body = JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: "pay_fixture", status: "captured" } } },
  });
  const send = (raw: string, id = eventId, signature?: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/payments/webhook",
      headers: {
        "content-type": "application/json",
        "x-razorpay-event-id": id,
        "x-razorpay-signature":
          signature ??
          createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
            .update(raw)
            .digest("hex"),
      },
      payload: raw,
    });
  try {
    assert.equal((await send(body, eventId, "0".repeat(64))).statusCode, 401);
    assert.equal((await send("null")).statusCode, 400);
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => send(body)),
    );
    assert(responses.every((r) => r.statusCode === 200));
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM payments.webhook_events WHERE provider_event_id=$1",
          [eventId],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (await send(body.replace("captured", "failed"))).statusCode,
      409,
    );
    assert.equal((await send(body, "x".repeat(201))).statusCode, 400);
  } finally {
    await app.close();
    if (original === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = original;
  }
});

test("Recovery HTTP command is owner scoped; callback rejects a different provider order before contacting Razorpay", async () => {
  const f = await fixture();
  await stage(f);
  const providerOrderId = "order_" + randomBytes(8).toString("hex");
  await store.created(f.order.id, providerOrderId);
  const token = randomBytes(24).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), f.owner],
  );
  // Synthetic credentials are confined to this process; these requests do not invoke a provider network operation.
  const priorId = process.env.RAZORPAY_KEY_ID,
    priorSecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_live_ISOLATED_CONFIGURATION_FIXTURE";
  process.env.RAZORPAY_KEY_SECRET = randomBytes(32).toString("hex");
  const app = await buildApp(),
    headers = { cookie: `session=${token}` },
    path = `/api/v1/bookings/${f.order.id}/payment`;
  try {
    assert.equal(
      (
        await app.inject({
          url: path + "/reconcile",
          method: "POST",
          payload: {},
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: path + "/reconcile",
          method: "POST",
          headers,
          payload: { amount: 1 },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/v1/bookings/${randomUUID()}/payment/reconcile`,
          method: "POST",
          headers,
          payload: {},
        })
      ).statusCode,
      404,
    );
    const response = await app.inject({
      url: path + "/reconcile",
      method: "POST",
      headers,
      payload: {},
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().state, "queued");
    const { createHmac } = await import("node:crypto");
    const paymentId = "pay_isolated";
    const signature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(providerOrderId + "|" + paymentId)
      .digest("hex");
    const callback = await app.inject({
      url: path + "/callback",
      method: "POST",
      headers,
      payload: { providerOrderId: "order_wrong", paymentId, signature },
    });
    assert.equal(callback.statusCode, 422);
    assert.equal(callback.json().code, "INVALID_PAYMENT_SIGNATURE");
  } finally {
    await app.close();
    if (priorId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = priorId;
    if (priorSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = priorSecret;
  }
});
