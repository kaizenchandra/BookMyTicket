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
const accept = (
  f: Awaited<ReturnType<typeof fixture>>,
  quoteId: string,
  key = randomUUID(),
) =>
  c.placement.accept(f.owner, key, {
    reservationId: f.hold.id,
    quoteId,
    acceptPolicies: true,
  }) as Promise<any>;
test("BE:PRC-01/06/07 — server itemization persists and repeated quotes never extend expiry", async () => {
  const f = await fixture();
  const quotes = await Promise.all(
    Array.from({ length: 12 }, () => c.quotes.create(f.owner, f.hold.id)),
  );
  assert.equal(new Set(quotes.map((q) => q.id)).size, 1);
  assert.equal(quotes[0].prices.totalPaise, 323);
  assert.equal(quotes[0].expiresAt, f.hold.expires_at.toISOString());
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM pricing.quotes WHERE reservation_id=$1",
        [f.hold.id],
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    pool.query("UPDATE pricing.quotes SET amount_paise=1 WHERE id=$1", [
      quotes[0].id,
    ]),
  );
});
test("BE:PRC-04 — absent policy produces unavailable, never zero-fee defaults", async () => {
  const f = await fixture(false);
  await assert.rejects(c.quotes.create(f.owner, f.hold.id), {
    code: "COMMERCIAL_POLICY_UNAVAILABLE",
  });
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM pricing.quotes WHERE reservation_id=$1",
        [f.hold.id],
      )
    ).rows[0].n,
    0,
  );
});
test("BE:PRC-08/09 — policy change requires new quote and explicit review", async () => {
  const f = await fixture(),
    old = await c.quotes.create(f.owner, f.hold.id);
  await assignFixturePolicy(f.owner, f.occurrence, {
    ...fixturePolicy,
    feePerOrderPaise: 20,
  });
  await assert.rejects(accept(f, old.id), { code: "QUOTE_CHANGED" });
  const fresh = await c.quotes.create(f.owner, f.hold.id);
  assert.notEqual(fresh.id, old.id);
  assert.equal(fresh.prices.totalPaise, 323); // Same total, different terms still require review.
  await assert.rejects(
    c.placement.accept(f.owner, randomUUID(), {
      reservationId: f.hold.id,
      quoteId: fresh.id,
      acceptPolicies: false,
    }),
    { code: "POLICY_ACCEPTANCE_REQUIRED" },
  );
  const order = await accept(f, fresh.id);
  assert.equal(order.quote_id, fresh.id);
  assert.equal(order.snapshot.quote.policy.feePerOrderPaise, 20);
});
test("BE:API-10/11/12 — concurrent acceptance, changed key payload and retry after expiry", async () => {
  const f = await fixture(),
    q = await c.quotes.create(f.owner, f.hold.id),
    key = randomUUID();
  const orders = await Promise.all(
    Array.from({ length: 15 }, () => accept(f, q.id, key)),
  );
  assert.equal(new Set(orders.map((o) => o.id)).size, 1);
  await assert.rejects(accept(f, randomUUID(), key), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [f.hold.id],
  );
  assert.equal((await accept(f, q.id, key)).id, orders[0].id);
  assert.equal((await accept(f, q.id, randomUUID())).id, orders[0].id);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int n FROM bookings.orders WHERE reservation_id=$1",
        [f.hold.id],
      )
    ).rows[0].n,
    1,
  );
});
test("BE:PRC-10/11,BKG-04 — accepted policies and amounts cannot be mutated", async () => {
  const f = await fixture(),
    q = await c.quotes.create(f.owner, f.hold.id),
    order = await accept(f, q.id);
  assert(order.accepted_at);
  assert.equal(order.amount_paise, 323);
  assert.equal(order.snapshot.acknowledgment.cancellation, true);
  await assert.rejects(
    pool.query("UPDATE bookings.orders SET amount_paise=0 WHERE id=$1", [
      order.id,
    ]),
  );
  await assert.rejects(
    pool.query(
      "UPDATE pricing.policies SET configuration='{}'::jsonb WHERE id=$1",
      [q.policyId],
    ),
  );
  await assignFixturePolicy(f.owner, f.occurrence, {
    ...fixturePolicy,
    feePerOrderPaise: 1000,
  });
  const historical = await c.bookings.get(f.owner, order.id);
  assert.equal(historical.amount_paise, 323);
  assert.equal(historical.snapshot.quote.policy.feePerOrderPaise, 5);
});
test("BE:RSV-03 — expiration and sales suspension are checked during acceptance", async () => {
  const f = await fixture(),
    q = await c.quotes.create(f.owner, f.hold.id);
  await pool.query(
    "UPDATE inventory.reservations SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [f.hold.id],
  );
  await assert.rejects(accept(f, q.id), { code: "RESERVATION_EXPIRED" });
  const g = await fixture(),
    r = await c.quotes.create(g.owner, g.hold.id);
  await pool.query(
    "UPDATE inventory.occurrences SET state='paused' WHERE id=$1",
    [g.occurrence],
  );
  await assert.rejects(accept(g, r.id), { code: "SALES_CLOSED" });
});
test("BE:BKG-03 — changed schedule cannot be accepted under the old snapshot", async () => {
  const f = await fixture(),
    q = await c.quotes.create(f.owner, f.hold.id);
  await pool.query(
    "UPDATE inventory.occurrences SET starts_at=starts_at+interval '10 minutes' WHERE id=$1",
    [f.occurrence],
  );
  await assert.rejects(accept(f, q.id), { code: "QUOTE_CHANGED" });
});
test("BE:ACL-01 — quote ownership and reservation association are enforced", async () => {
  const f = await fixture(),
    g = await fixture(),
    q = await c.quotes.create(f.owner, f.hold.id);
  await assert.rejects(c.quotes.create(g.owner, f.hold.id), {
    code: "NOT_FOUND",
  });
  await assert.rejects(accept(g, q.id), { code: "NOT_FOUND" });
  const other = (await reservations.reserve(f.owner, randomUUID(), [
    { occurrenceId: f.occurrence, resourceId: "pool", quantity: 1 },
  ])) as any;
  await assert.rejects(
    c.placement.accept(f.owner, randomUUID(), {
      reservationId: other.id,
      quoteId: q.id,
      acceptPolicies: true,
    }),
    { code: "QUOTE_MISMATCH" },
  );
});
test("BE:SCH-08 — simultaneous policy assignment updates have one version winner", async () => {
  const f = await fixture();
  const assignment = (await policies.assignment(f.occurrence)) as {
    version: number;
  };
  const outcomes = await Promise.allSettled(
    Array.from({ length: 10 }, () =>
      policies.assign(f.owner, f.occurrence, f.policyId!, assignment.version),
    ),
  );
  assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
  for (const o of outcomes)
    if (o.status === "rejected")
      assert.equal(o.reason.code, "VERSION_CONFLICT");
});
test("HTTP quote → acceptance → booking; tampering, staff MFA/grants and immutable snapshots", async () => {
  const app = await buildApp(),
    f = await fixture(),
    token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified) VALUES($1,$2,now()+interval '1 hour',false)",
    [hashToken(token), f.owner],
  );
  const cookies = { session: token };
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/quotes",
      cookies,
      payload: { reservationId: f.hold.id },
    });
    assert.equal(response.statusCode, 200);
    const q = quoteResponseSchema.parse(response.json());
    const tampered = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      cookies,
      headers: { "idempotency-key": randomUUID() },
      payload: {
        reservationId: f.hold.id,
        quoteId: q.id,
        acceptPolicies: true,
        amountPaise: 1,
      },
    });
    assert.equal(tampered.statusCode, 422);
    const accepted = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      cookies,
      headers: { "idempotency-key": randomUUID() },
      payload: {
        reservationId: f.hold.id,
        quoteId: q.id,
        acceptPolicies: true,
      },
    });
    assert.equal(accepted.statusCode, 200);
    const order = accepted.json();
    assert.equal(order.amount_paise, 323);
    assert.equal(order.state, "pending_payment");
    assert.equal(
      (
        await app.inject({ url: `/api/v1/bookings/${order.id}`, cookies })
      ).json().snapshot.quote.id,
      q.id,
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/admin/pricing/policies", cookies }))
        .statusCode,
      403,
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=clock_timestamp() WHERE token_hash=$1",
      [hashToken(token)],
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/admin/pricing/policies", cookies }))
        .statusCode,
      403,
    );
    await pool.query(
      "INSERT INTO identity.grants VALUES($1,'pricing','platform')",
      [f.owner],
    );
    const policy = await app.inject({
      method: "POST",
      url: "/api/v1/admin/pricing/policies",
      cookies,
      payload: {
        label: "HTTP TEST POLICY",
        reason: "Isolated test approval",
        configuration: fixturePolicy,
      },
    });
    assert.equal(policy.statusCode, 200);
    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='pricing'",
      [f.owner],
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/admin/pricing/policies", cookies }))
        .statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
