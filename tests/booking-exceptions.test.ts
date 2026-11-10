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
const reason = "Operations reviewed this booking";
async function order(
  owner: string,
  state = "pending_payment",
  startsAt = "2081-01-01T10:00:00Z",
  listingId?: string,
) {
  const id = randomUUID(),
    reservation = randomUUID();
  await pool.query(
    "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'fixture','active',now()+interval '1 hour')",
    [reservation, owner, reservation],
  );
  await pool.query(
    "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at) VALUES($1,$2,$3,100,'INR','fixture',$4,$5,now()-interval '1 hour')",
    [
      id,
      owner,
      reservation,
      state,
      {
        occurrences: [
          { id: randomUUID(), title: "Test booking", startsAt, listingId },
        ],
        private: "DO-NOT-EXPOSE",
      },
    ],
  );
  return { id, reservation };
}
test("Booking exception workflow is authorized, versioned, retry-safe and audited with durable events", async () => {
  const app = await buildApp(),
    a = await account(["bookings.read", "bookings.manage"]),
    reader = await account(["bookings.read"]),
    weak = await account(["bookings.read", "bookings.manage"], false),
    customer = await account(),
    b = await order(customer.id),
    url = "/api/v1/admin/bookings/" + b.id + "/exceptions";
  const command = (
    action: string,
    version: number,
    assignedTo?: string | null,
    key = randomUUID(),
  ) =>
    app.inject({
      method: "POST",
      url,
      headers: { ...a.headers, "idempotency-key": key },
      payload: {
        action,
        expectedVersion: version,
        reason,
        ...(assignedTo !== undefined ? { assignedTo } : {}),
      },
    });
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal(
      (await app.inject({ url, headers: weak.headers })).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url,
          headers: reader.headers,
          payload: {},
        })
      ).statusCode,
      403,
    );
    const key = randomUUID();
    let r = await command("open", 0, undefined, key);
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await command("open", 0, undefined, key)).json().version, 1);
    assert.equal(
      (await command("escalate", 1, undefined, key)).statusCode,
      409,
    );
    assert.equal((await command("assign", 1, reader.id)).statusCode, 403);
    r = await command("assign", 1, a.id);
    assert.equal(r.statusCode, 200, r.body);
    const race = await Promise.all([
      command("escalate", 2),
      command("resolve", 2),
    ]);
    assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
    const current = (await app.inject({ url, headers: a.headers })).json()
      .exception;
    if (current.state === "escalated") {
      r = await command("resolve", 3);
      assert.equal(r.statusCode, 200, r.body);
    }
    const resolved = (await app.inject({ url, headers: a.headers })).json()
      .exception;
    assert.equal(
      (await command("assign", resolved.version, a.id)).statusCode,
      409,
    );
    r = await command("reopen", resolved.version);
    assert.equal(r.statusCode, 200, r.body);
    const list = await app.inject({
      url:
        "/api/v1/admin/bookings?customer=" +
        customer.id +
        "&exception=open&assignedTo=" +
        a.id,
      headers: a.headers,
    });
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().items[0].id, b.id);
    const history = (await app.inject({ url, headers: a.headers })).json()
      .history.items;
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM reporting.outbox WHERE aggregate_id=$1 AND type='booking.exception_changed'",
          [b.id],
        )
      ).rowCount,
      history.length,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM bookings.admin_exception_history WHERE order_id=$1",
        [b.id],
      ),
      /immutable/,
    );
    assert.equal(
      (
        await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
          b.id,
        ])
      ).rows[0].state,
      "pending_payment",
    );
  } finally {
    await app.close();
  }
});
test("Admin pending cancellation previews and retries preserve inventory, attribution and confirmed state safeguards", async () => {
  const app = await buildApp(),
    a = await account(["bookings.read", "bookings.manage"]),
    customer = await account(),
    b = await order(customer.id),
    url = "/api/v1/admin/bookings/" + b.id + "/pending-cancellation";
  try {
    let r = await app.inject({
      method: "POST",
      url: url + "/preview",
      headers: a.headers,
      payload: {},
    });
    assert.equal(r.statusCode, 200, r.body);
    const preview = r.json();
    assert.equal(preview.allowed, true);
    const key = randomUUID(),
      payload = {
        previewId: preview.previewId,
        reason,
        acknowledgePaymentRisk: true,
      },
      headers = { ...a.headers, "idempotency-key": key };
    r = await app.inject({ method: "POST", url, headers, payload });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().bookingState, "cancelled");
    r = await app.inject({ method: "POST", url, headers, payload });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url,
          headers,
          payload: { ...payload, reason: "Different cancellation reason" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM inventory.reservations WHERE id=$1",
          [b.reservation],
        )
      ).rows[0].state,
      "released",
    );
    const confirmed = await order(customer.id, "confirmed");
    r = await app.inject({
      method: "POST",
      url:
        "/api/v1/admin/bookings/" +
        confirmed.id +
        "/pending-cancellation/preview",
      headers: a.headers,
      payload: {},
    });
    assert.equal(r.json().allowed, false);
    assert.equal(
      (
        await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
          confirmed.id,
        ])
      ).rows[0].state,
      "confirmed",
    );
    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='bookings.manage'",
      [a.id],
    );
    assert.equal(
      (await app.inject({ method: "POST", url, headers, payload })).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
test("Travel dates and stalled exception filters use saved occurrence dates and do not leak snapshots", async () => {
  const app = await buildApp(),
    a = await account(["bookings.read"]),
    customer = await account();
  await order(customer.id);
  await order(customer.id, "confirmed", "2082-01-01T00:00:00Z");
  try {
    const base = "/api/v1/admin/bookings?customer=" + customer.id;
    let r = await app.inject({
      url:
        base +
        "&travelFrom=2081-01-01T00:00:00Z&travelUntil=2081-01-02T00:00:00Z&exception=stalled",
      headers: a.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 1);
    assert.ok(!r.body.includes("DO-NOT-EXPOSE"));
    r = await app.inject({ url: base + "&pnr=UNKNOWN", headers: a.headers });
    assert.equal(r.json().items.length, 0);
    r = await app.inject({ url: base + "&product=movie", headers: a.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 0);
    assert.equal(
      (
        await app.inject({
          url:
            base +
            "&travelFrom=2082-01-01T00:00:00Z&travelUntil=2081-01-01T00:00:00Z",
          headers: a.headers,
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
test("Product and supplier filters match persisted listing references before pagination", async () => {
  const app = await buildApp(),
    a = await account(["bookings.read"]),
    customer = await account(),
    org = randomUUID(),
    listing = randomUUID();
  try {
    await pool.query(
      "INSERT INTO providers.organizations(id,owner_id,name,kind) VALUES($1,$2,'Fixture cinema','cinema')",
      [org, customer.id],
    );
    await pool.query(
      "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description) VALUES($1,$2,'Fixture movie','movie','Pune','Fixture')",
      [listing, org],
    );
    const b = await order(customer.id, "pending_payment", undefined, listing);
    let r = await app.inject({
      url:
        "/api/v1/admin/bookings?customer=" +
        customer.id +
        "&supplier=" +
        org +
        "&product=movie",
      headers: a.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items[0].id, b.id);
    r = await app.inject({
      url:
        "/api/v1/admin/bookings?customer=" +
        customer.id +
        "&supplier=" +
        org +
        "&product=event",
      headers: a.headers,
    });
    assert.equal(r.json().items.length, 0);
  } finally {
    await app.close();
  }
});
test("Exception state and replay writes roll back on failed audit", async () => {
  const { BookingExceptions } =
      await import("../src/modules/bookings/application/exceptions.ts"),
    { PostgresBookingExceptions } =
      await import("../src/modules/bookings/adapters/exceptions.ts"),
    { PostgresStaffAuthorization } =
      await import("../src/modules/identity/adapters/staff-authorization.ts"),
    { PostgresEvents } =
      await import("../src/modules/reporting/adapters/outbox.ts");
  const a = await account(["bookings.read", "bookings.manage"]),
    b = await order(a.id),
    key = randomUUID();
  const service = new BookingExceptions(
    new PostgresBookingExceptions(),
    new PostgresStaffAuthorization(),
    {
      record: async () => {
        throw Error("Audit failed");
      },
    },
    new PostgresEvents(),
  );
  await assert.rejects(
    service.change(a.id, b.id, key, {
      action: "open",
      expectedVersion: 0,
      reason,
    }),
    /Audit failed/,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT 1 FROM bookings.admin_exceptions WHERE order_id=$1",
        [b.id],
      )
    ).rowCount,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT 1 FROM bookings.admin_exception_commands WHERE actor_id=$1 AND key=$2",
        [a.id, key],
      )
    ).rowCount,
    0,
  );
});
test("Staff ticket documents require manage permission and MFA and preserve confirmed-only access", async () => {
  const app = await buildApp(),
    a = await account(["bookings.read", "bookings.manage"]),
    reader = await account(["bookings.read"]),
    weak = await account(["bookings.read", "bookings.manage"], false),
    customer = await account(),
    b = await order(customer.id, "confirmed"),
    pending = await order(customer.id),
    url = "/api/v1/admin/bookings/" + b.id + "/tickets/download";
  try {
    for (const who of [reader, weak, customer])
      assert.equal(
        (await app.inject({ url, headers: who.headers })).statusCode,
        403,
      );
    const r = await app.inject({ url, headers: a.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.ok(r.headers["content-disposition"]?.includes("attachment"));
    assert.match(r.body, /BookMyTicket/);
    assert.ok(!r.body.includes("DO-NOT-EXPOSE"));
    assert.match(r.headers["cache-control"] ?? "", /no-store/);
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/bookings/" + pending.id + "/tickets/download",
          headers: a.headers,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM reporting.audit WHERE actor_id=$1 AND target=$2 AND action='bookings.ticket_document.read'",
          [a.id, b.id],
        )
      ).rowCount,
      1,
    );
  } finally {
    await app.close();
  }
});
