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
  throw Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account(permissions: string[] = [], mfa = true) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    id + "@fixture.invalid",
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
    [hashToken(token), id, mfa],
  );
  for (const p of permissions)
    await pool.query("INSERT INTO identity.grants VALUES($1,$2,'platform')", [
      id,
      p,
    ]);
  return { id, headers: { cookie: "session=" + token } };
}
import { PostgresCollection } from "../src/modules/payments/adapters/collection.ts";
import {
  csvCell,
  paymentMetadata,
} from "../src/modules/payments/domain/metadata.ts";
async function fixture(owner: string) {
  const id = randomUUID(),
    reservation = randomUUID();
  await pool.query(
    "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'fixture','active',now()+interval '1 hour')",
    [reservation, owner, reservation],
  );
  await pool.query(
    "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot) VALUES($1,$2,$3,10000,'INR','fixture','pending_payment','{}')",
    [id, owner, reservation],
  );
  await pool.query(
    "INSERT INTO payments.provider_orders(order_id,provider_id,amount_paise,state) VALUES($1,$2,10000,'ready')",
    [id, "order_" + randomUUID().replaceAll("-", "")],
  );
  return id;
}
test("Provider metadata is bounded and excludes free text, and CSV cells neutralize formula prefixes", () => {
  assert.deepEqual(
    paymentMetadata({
      method: "upi",
      error_code: "BAD_REQUEST_ERROR",
      error_reason: "incorrect_otp",
      amount_refunded: 150,
      amount: 10000,
    }),
    {
      method: "upi",
      errorCode: "BAD_REQUEST_ERROR",
      errorReason: "incorrect_otp",
      refunded: "150",
    },
  );
  assert.deepEqual(
    paymentMetadata({
      method: "secret@example.com",
      error_code: "mail@example.com",
      error_reason: "customer phone 123",
      amount_refunded: 10001,
      amount: 10000,
    }),
    { method: null, errorCode: null, errorReason: null, refunded: null },
  );
  assert.equal(csvCell(" =SUM(A1:A2)"), '"\' =SUM(A1:A2)"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
test("Payment method/refund observations preserve exact values, monotonic refunds and immutable history", async () => {
  const a = await account(),
    id = await fixture(a.id),
    store = new PostgresCollection(),
    pid = "pay_" + randomUUID().replaceAll("-", "");
  const payment = {
    id: pid,
    order_id: "ignored-by-store",
    amount: 10000,
    currency: "INR",
    status: "captured",
    method: "upi",
    amount_refunded: 0,
  };
  await store.observe(id, payment);
  await store.observe(id, { ...payment, amount_refunded: 100 });
  await store.observe(id, {
    ...payment,
    status: "authorized",
    amount_refunded: 0,
  });
  const row = (
    await pool.query(
      "SELECT * FROM payments.attempts WHERE provider_payment_id=$1",
      [pid],
    )
  ).rows[0];
  assert.equal(row.state, "captured");
  assert.equal(row.amount_refunded_paise, "100");
  assert.equal(row.method, "upi");
  assert.equal(
    (
      await pool.query(
        "SELECT 1 FROM payments.attempt_observations WHERE provider_payment_id=$1",
        [pid],
      )
    ).rowCount,
    2,
  );
  await assert.rejects(
    pool.query(
      "DELETE FROM payments.attempt_observations WHERE provider_payment_id=$1",
      [pid],
    ),
    /immutable/,
  );
  await assert.rejects(
    store.observe(id, { ...payment, amount: 9999 }),
    /conflicts/,
  );
});
test("Finance APIs enforce MFA and permissions, filter transactions, separate capture/settlement and export approved CSV", async () => {
  const app = await buildApp(),
    a = await account(["finance"]),
    weak = await account(["finance"], false),
    customer = await account(),
    id = await fixture(customer.id),
    store = new PostgresCollection(),
    pid = "pay_" + randomUUID().replaceAll("-", "");
  try {
    await store.observe(id, {
      id: pid,
      order_id: "fixture",
      amount: 10000,
      currency: "INR",
      status: "failed",
      method: "card",
      error_code: "BAD_REQUEST_ERROR",
      error_reason: "incorrect_otp",
      amount_refunded: 0,
    });
    const url =
      "/api/v1/admin/payments?booking=" +
      id +
      "&method=card&state=failed&provider=razorpay&transaction=" +
      pid;
    for (const who of [weak, customer])
      assert.equal(
        (await app.inject({ url, headers: who.headers })).statusCode,
        403,
      );
    let r = await app.inject({ url, headers: a.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 1);
    const attempt = r.json().items[0];
    assert.equal(attempt.transaction_id, pid);
    r = await app.inject({
      url: "/api/v1/admin/payments/" + attempt.id,
      headers: a.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().capture, null);
    assert.equal(r.json().settlement.state, "not_connected");
    assert.equal(r.json().refundEligibility.actionAvailable, false);
    assert.equal(r.json().history.items[0].error_reason, "incorrect_otp");
    const filters = {
        booking: id,
        from: "2020-01-01T00:00:00Z",
        until: "2090-01-01T00:00:00Z",
      },
      payload = {
        filters,
        reason: "Approved finance transaction export",
        confirm: true,
      };
    r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/payments/reports",
      headers: a.headers,
      payload,
    });
    assert.equal(r.statusCode, 422);
    const now = Date.now();
    payload.filters.from = new Date(now - 86400000).toISOString();
    payload.filters.until = new Date(now + 86400000).toISOString();
    r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/payments/reports",
      headers: a.headers,
      payload,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().rows, 1);
    assert.match(r.json().csv, /"10000"/);
    assert.match(r.json().csv, /incorrect_otp/);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/payments/reports",
          headers: a.headers,
          payload: { ...payload, confirm: false },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/payments/reports",
          headers: customer.headers,
          payload,
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
test("Payment pagination binds filters/actor and exceptions include provider orders without attempts", async () => {
  const app = await buildApp(),
    a = await account(["finance"]),
    other = await account(["finance"]),
    id = await fixture(a.id),
    store = new PostgresCollection();
  try {
    for (let i = 0; i < 27; i++)
      await store.observe(id, {
        id: "pay_" + randomUUID().replaceAll("-", ""),
        order_id: "fixture",
        amount: 10000,
        currency: "INR",
        status: "authorized",
        method: "upi",
      });
    const url = "/api/v1/admin/payments?booking=" + id,
      first = (await app.inject({ url, headers: a.headers })).json();
    assert.equal(first.items.length, 25);
    const next = url + "&after=" + encodeURIComponent(first.nextCursor),
      second = (await app.inject({ url: next, headers: a.headers })).json();
    assert.equal(second.items.length, 2);
    assert.equal(
      new Set([...first.items, ...second.items].map((x) => x.id)).size,
      27,
    );
    assert.equal(
      (await app.inject({ url: next + "&method=upi", headers: a.headers }))
        .statusCode,
      422,
    );
    assert.equal(
      (await app.inject({ url: next, headers: other.headers })).statusCode,
      422,
    );
    const empty = await fixture(a.id);
    await pool.query(
      "UPDATE payments.provider_orders SET state='unknown',review_required=true,created_at='2099-01-01' WHERE order_id=$1",
      [empty],
    );
    const r = await app.inject({
      url: "/api/v1/admin/payment-exceptions",
      headers: a.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.json().items.some((x: {id:string}) => x.id === empty));
  } finally {
    await app.close();
  }
});
