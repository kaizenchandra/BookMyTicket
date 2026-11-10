import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { pricePreview } from "../src/modules/flights/domain/commercial.ts";
import { FlightAdministration } from "../src/modules/flights/application/administration.ts";
import { PostgresFlights } from "../src/modules/flights/adapters/postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
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
function input() {
  return {
    code: "s-" + randomUUID(),
    name: "Test Supplier",
    airlineCodes: ["ZZ"],
    environment: "sandbox",
    reason: "Register contracted sandbox supplier",
  };
}
test("Flight commercial arithmetic retains precision and rounds half-up without inventing availability", () => {
  assert.deepEqual(
    pricePreview("1", "0", {
      version: 1,
      markup_bps: 5000,
      service_fee_paise: "2",
    }),
    {
      currency: "INR",
      basePaise: "1",
      taxPaise: "0",
      markupPaise: "1",
      serviceFeePaise: "2",
      totalPaise: "4",
      ruleVersion: 1,
      bookable: false,
    },
  );
  assert.equal(
    pricePreview("999999999999999999", "1", {
      version: 2,
      markup_bps: 10000,
      service_fee_paise: "0",
    }).totalPaise,
    "1999999999999999999",
  );
  assert.throws(() =>
    pricePreview("-1", "0", {
      version: 1,
      markup_bps: 0,
      service_fee_paise: "0",
    }),
  );
});
test("Flight supplier administration enforces MFA/grants, idempotency, version checks and honest integration state", async () => {
  const app = await buildApp(),
    manager = await account(["flights.read", "flights.manage", "pricing"]),
    reader = await account(["flights.read"]),
    weak = await account(["flights.read", "flights.manage"], false),
    writeOnly = await account(["flights.manage"]);
  const body = input(),
    key = randomUUID(),
    create = (who = manager, payload = body, requestKey = key) =>
      app.inject({
        method: "POST",
        url: "/api/v1/admin/flights/suppliers",
        headers: { ...who.headers, "idempotency-key": requestKey },
        payload,
      });
  try {
    assert.equal((await create(reader)).statusCode, 403);
    assert.equal((await create(weak)).statusCode, 403);
    assert.equal((await create(writeOnly)).statusCode, 403);
    const responses = await Promise.all([create(), create()]);
    assert(
      responses.every((r) => r.statusCode === 200),
      responses.map((r) => r.body).join(),
    );
    const id = responses[0].json().id;
    assert.equal(responses[1].json().id, id);
    assert.equal(
      (await create(manager, { ...body, name: "Changed" })).statusCode,
      409,
    );
    assert.equal((await create(manager, body, randomUUID())).statusCode, 409);
    const path = "/api/v1/admin/flights/suppliers/" + id;
    let r = await app.inject({ url: path, headers: reader.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().integration.state, "not_configured");
    assert.equal(r.json().rule, null);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/price-preview",
          headers: manager.headers,
          payload: { basePaise: "10", taxPaise: "0" },
        })
      ).statusCode,
      409,
    );
    const updates = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: "PATCH",
          url: path,
          headers: manager.headers,
          payload: { ...body, expectedVersion: 1, status: "suspended" },
        }),
      ),
    );
    assert.deepEqual(updates.map((r) => r.statusCode).sort(), [200, 409]);
    r = await app.inject({
      method: "PATCH",
      url: path,
      headers: manager.headers,
      payload: { ...body, expectedVersion: 2, status: "active" },
    });
    assert.equal(r.statusCode, 422);
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/flights/suppliers/" + randomUUID(),
          headers: reader.headers,
        })
      ).statusCode,
      404,
    );
    const commercial = {
      expectedVersion: 0,
      markupBps: 125,
      serviceFeePaise: "100",
      reason: "Approved sandbox pricing calculation",
    };
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: path + "/commercial-rule",
          headers: reader.headers,
          payload: commercial,
        })
      ).statusCode,
      403,
    );
    r = await app.inject({
      method: "PUT",
      url: path + "/commercial-rule",
      headers: manager.headers,
      payload: commercial,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: path + "/commercial-rule",
          headers: manager.headers,
          payload: commercial,
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "POST",
      url: path + "/price-preview",
      headers: manager.headers,
      payload: { basePaise: "10000", taxPaise: "1800" },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().totalPaise, "12025");
    assert.equal(r.json().bookable, false);
    assert(
      (
        await pool.query(
          "SELECT 1 FROM reporting.audit WHERE target=$1 AND action='flights.commercial.changed'",
          [id],
        )
      ).rowCount,
    );
  } finally {
    await app.close();
  }
});
test("Flight supplier search paginates before limits and rejects changed cursor scope", async () => {
  const app = await buildApp(),
    staff = await account(["flights.read"]),
    prefix = randomUUID();
  try {
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO flights.suppliers(id,code,name,environment,created_at) VALUES($1,$2,$3,'sandbox','2078-01-01')",
        [randomUUID(), prefix + "-" + i, prefix],
      );
    const get = (query: string) =>
      app.inject({
        url: "/api/v1/admin/flights/suppliers?q=" + prefix + query,
        headers: staff.headers,
      });
    let r = await get("");
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 25);
    const first = r.json(),
      cursor = encodeURIComponent(first.nextCursor);
    r = await get("&after=" + cursor);
    assert.equal(r.json().items.length, 2);
    assert.equal(
      new Set([...first.items, ...r.json().items].map((x) => x.id)).size,
      27,
    );
    assert.equal((await get("&status=draft&after=" + cursor)).statusCode, 422);
    assert.equal((await get("&status=suspended")).json().items.length, 0);
  } finally {
    await app.close();
  }
});
test("Flight supplier mutations roll back when audit persistence fails", async () => {
  const staff = await account(["flights.read", "flights.manage"]),
    body = input(),
    service = new FlightAdministration(
      new PostgresFlights(new PostgresStaffAuthorization()),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    service.create(staff.id, randomUUID(), { ...body, environment: "sandbox" }),
    /Audit unavailable/,
  );
  assert.equal(
    (
      await pool.query("SELECT 1 FROM flights.suppliers WHERE code=$1", [
        body.code,
      ])
    ).rowCount,
    0,
  );
});
