import { dashboardRange } from "../src/modules/reporting/application/dashboard.ts";
import { dashboardFilters } from "../src/modules/reporting/adapters/dashboard-schema.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { AccountAdministration } from "../src/modules/identity/application/administration.ts";
import { PostgresAccountAdministration } from "../src/modules/identity/adapters/administration.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account(permissions: string[] = [], mfa = true) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex"),
    contact = `${id}@fixture.invalid`;
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    contact,
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
  return { id, contact, headers: { cookie: `session=${token}` } };
}
test("Admin account directory masks contacts; changes revoke sessions, reject escalation and serialize edits", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage", "customers.read"]),
    customer = await account(),
    weak = await account(["access.manage"], false);
  const patch = (
    who = manager,
    body: Record<string, unknown> = {
      expectedVersion: 1,
      status: "suspended",
      reason: "Investigated account abuse",
    },
    id = customer.id,
  ) =>
    app.inject({
      method: "PATCH",
      url: `/api/v1/admin/users/${id}`,
      headers: who.headers,
      payload: body,
    });
  try {
    assert.equal((await patch(customer)).statusCode, 403);
    assert.equal((await patch(weak)).statusCode, 403);
    assert.equal(
      (
        await patch(
          manager,
          {
            expectedVersion: 1,
            status: "suspended",
            reason: "Self modification attempt",
          },
          manager.id,
        )
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await patch(manager, {
          expectedVersion: 1,
          permissions: ["root"],
          reason: "Invalid permission assignment",
        })
      ).statusCode,
      422,
    );
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/admin/customers?id=${customer.id}&status=&contact=`,
      headers: manager.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes(customer.contact));
    assert.equal(response.json().items[0].id, customer.id);
    // Exact reference can find a verified customer before their first staff grant.
    const target = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users?id=${customer.id}`,
      headers: manager.headers,
    });
    assert.equal(target.json().items.length, 1);
    const results = await Promise.all([patch(), patch()]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [customer.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM reporting.audit WHERE actor_id=$1 AND action='identity.admin.changed' AND target=$2",
          [manager.id, customer.id],
        )
      ).rowCount,
      1,
    );
    const restored = await patch(manager, {
      expectedVersion: 2,
      status: "active",
      permissions: ["bookings.read"],
      reason: "Account review completed",
    });
    assert.equal(restored.statusCode, 200, restored.body);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [customer.id],
        )
      ).rowCount,
      0,
    );
    assert.deepEqual(restored.json().permissions, ["bookings.read"]);
    const rollbackTarget = await account();
    const service = new AccountAdministration(
      new PostgresAccountAdministration(),
      {
        record: async () => {
          throw Error("audit unavailable");
        },
      },
    );
    await assert.rejects(
      service.change(manager.id, rollbackTarget.id, {
        expectedVersion: 1,
        status: "suspended",
        reason: "Rollback verification",
      }),
      /audit unavailable/,
    );
    assert.equal(
      (
        await pool.query("SELECT status FROM identity.accounts WHERE id=$1", [
          rollbackTarget.id,
        ])
      ).rows[0].status,
      "active",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [rollbackTarget.id],
        )
      ).rowCount,
      1,
    );
  } finally {
    await app.close();
  }
});
test("Booking operations paginate and filter before limits, protect details, and separate payment/fulfillment", async () => {
  const app = await buildApp(),
    staff = await account(["bookings.read", "finance"]),
    other = await account(["bookings.read"]),
    customer = await account();
  const ids: string[] = [];
  try {
    for (let i = 0; i < 27; i++) {
      const id = randomUUID(),
        reservation = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'test','active',now()+interval '1 hour')",
        [reservation, customer.id, reservation],
      );
      await pool.query(
        "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at) VALUES($1,$2,$3,100,'INR','test','pending_payment',$4,'2075-01-01')",
        [
          id,
          customer.id,
          reservation,
          {
            occurrences: [
              {
                id: randomUUID(),
                title: "Admin fixture",
                privateContact: "SECRET-CONTACT",
              },
            ],
            private: "SECRET-SNAPSHOT",
          },
        ],
      );
    }
    const url = `/api/v1/admin/bookings?customer=${customer.id}&state=pending_payment`;
    assert.equal((await app.inject({ method: "GET", url })).statusCode, 401);
    assert.equal(
      (await app.inject({ method: "GET", url, headers: customer.headers }))
        .statusCode,
      403,
    );
    const first = await app.inject({
      method: "GET",
      url,
      headers: staff.headers,
    });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.headers["cache-control"], "no-store");
    assert.equal(first.json().items.length, 25);
    assert.ok(first.json().nextCursor);
    const next = await app.inject({
      method: "GET",
      url: `${url}&after=${first.json().nextCursor}`,
      headers: staff.headers,
    });
    assert.equal(next.json().items.length, 2);
    assert.equal(
      new Set([...first.json().items, ...next.json().items].map((r) => r.id))
        .size,
      27,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `${url}&after=${first.json().nextCursor}`,
          headers: other.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `${url}&after=${first.json().nextCursor}&confirmed=true`,
          headers: staff.headers,
        })
      ).statusCode,
      422,
    );
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/admin/bookings/${ids[0]}`,
      headers: staff.headers,
    });
    assert.equal(detail.statusCode, 200, detail.body);
    assert.ok(!detail.body.includes("SECRET"));
    assert.deepEqual(detail.json().fulfillment, []);
    assert.deepEqual(detail.json().payments.items, []);
    assert.equal(detail.json().booking.timeline[0].kind, "created");
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/admin/bookings/${randomUUID()}`,
          headers: staff.headers,
        })
      ).statusCode,
      404,
    );
    const providerId = randomUUID();
    await pool.query(
      "INSERT INTO payments.provider_orders(order_id,amount_paise,state) VALUES($1,100,'creating')",
      [ids[0]],
    );
    await pool.query(
      "INSERT INTO payments.attempts(provider_payment_id,order_id,amount_paise,currency,state) VALUES($1,$2,100,'INR','refunded')",
      [providerId, ids[0]],
    );
    await pool.query(
      "INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise) VALUES($1,$2,$3,'PRIVATE-REASON',100)",
      [randomUUID(), ids[0], providerId],
    );
    for (const path of ["payments", "refunds"]) {
      const r = await app.inject({
        method: "GET",
        url: `/api/v1/admin/${path}?booking=${ids[0]}`,
        headers: staff.headers,
      });
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().items.length, 1);
      if(path === "payments") assert.equal(r.json().items[0].transaction_id,providerId);
      else assert.ok(!r.body.includes(providerId));
      assert.ok(!r.body.includes("PRIVATE-REASON"));
    }
  } finally {
    await app.close();
  }
});

test("Dashboard presets use database-clock IST days and custom range validation", () => {
  const now = new Date("2026-01-01T20:00:00Z");
  assert.deepEqual(dashboardRange(now, { range: "today" }), {
    from: "2026-01-01T18:30:00.000Z",
    until: "2026-01-02T18:30:00.000Z",
  });
  assert.deepEqual(dashboardRange(now, { range: "7days" }), {
    from: "2025-12-26T18:30:00.000Z",
    until: "2026-01-02T18:30:00.000Z",
  });
  assert.deepEqual(
    dashboardRange(now, {
      range: "custom",
      from: "2026-01-01",
      until: "2026-01-03",
    }),
    { from: "2025-12-31T18:30:00.000Z", until: "2026-01-02T18:30:00.000Z" },
  );
  assert.throws(() =>
    dashboardFilters.parse({
      year: 2026,
      group: "year",
      range: "custom",
      from: "2026-01-02",
      until: "2026-01-01",
    }),
  );
  assert.throws(() =>
    dashboardFilters.parse({
      year: 2026,
      group: "year",
      range: "today",
      from: "2026-01-01",
    }),
  );
});
