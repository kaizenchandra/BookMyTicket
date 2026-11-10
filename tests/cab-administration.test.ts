import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { CabAdministration } from "../src/modules/cabs/application/administration.ts";
import { PostgresCabs } from "../src/modules/cabs/adapters/postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import type {
  Supplier,
  Category,
  Service,
} from "../src/modules/cabs/domain/catalogue.ts";
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
const reason = "Reviewed cab service configuration";
const supplier: Supplier = {
  name: "Fixture supplier",
  contactEmail: "cab@fixture.invalid",
  contactPhone: "+919876543210",
  supplierReference: "Contract fixture",
  active: true,
};
const category: Category = {
  name: "Sedan",
  passengers: 4,
  luggage: 2,
  amenities: "Air conditioning",
  active: true,
};
function service(supplierId: string, categoryId: string): Service {
  return {
    name: "Airport transfer",
    supplierId,
    categoryId,
    mode: "airport",
    origin: "PNQ",
    destination: "Pune",
    availableFrom: "2081-01-01T00:00:00Z",
    availableUntil: "2081-02-01T00:00:00Z",
    maxDistanceMeters: 100000,
    basePaise: "10000",
    includedMeters: 10000,
    perKmPaise: "1500",
    includedWaitingMinutes: 10,
    waitingMinutePaise: "100",
    driverAllowancePaise: "5000",
    airportFeePaise: "2000",
    cancellationPolicy: "Cancellation must be requested through supplier.",
  };
}
function preview() {
  return {
    expectedVersion: 1,
    pickupAt: "2081-01-10T09:00:00Z",
    origin: "pnq",
    destination: "pune",
    passengers: 4,
    luggage: 2,
    distanceMeters: 11001,
    durationMinutes: 60,
    waitingMinutes: 12,
  };
}
test("Cab administration enforces permissions, MFA, replay, versions and immutable history", async () => {
  const app = await buildApp(),
    a = await account(["cabs.read", "cabs.manage"]),
    read = await account(["cabs.read"]),
    noMfa = await account(["cabs.read", "cabs.manage"], false);
  const post = (
    kind: string,
    content: unknown,
    key = randomUUID(),
    code = "c-" + randomUUID(),
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/cabs/" + kind,
      headers: { ...a.headers, "idempotency-key": key },
      payload: { content, code, reason },
    });
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/admin/cabs/suppliers" })).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/cabs/suppliers",
          headers: noMfa.headers,
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/cabs/suppliers",
          headers: read.headers,
          payload: {},
        })
      ).statusCode,
      403,
    );
    const key = randomUUID(),
      code = "c-" + randomUUID();
    let r = await post("suppliers", supplier, key, code);
    assert.equal(r.statusCode, 200, r.body);
    const sid = r.json().id;
    assert.equal((await post("suppliers", supplier, key, code)).json().id, sid);
    assert.equal(
      (await post("suppliers", { ...supplier, name: "Changed" }, key, code))
        .statusCode,
      409,
    );
    assert.equal(
      (await post("suppliers", supplier, randomUUID(), code)).statusCode,
      409,
    );
    const cid = (await post("categories", category)).json().id,
      id = (await post("services", service(sid, cid))).json().id,
      url = "/api/v1/admin/cabs/services/" + id;
    r = await app.inject({ url, headers: a.headers });
    assert.equal(r.json().integration.tripStatus, null);
    assert.equal(r.json().integration.bookable, false);
    r = await app.inject({
      method: "PATCH",
      url,
      headers: a.headers,
      payload: { content: service(sid, cid), expectedVersion: 1, reason },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url,
          headers: a.headers,
          payload: { content: service(sid, cid), expectedVersion: 1, reason },
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "POST",
      url: url + "/disruptions",
      headers: a.headers,
      payload: { action: "disrupt", expectedVersion: 2, reason },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: url + "/preview",
          headers: a.headers,
          payload: { ...preview(), expectedVersion: 3 },
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "POST",
      url: url + "/disruptions",
      headers: a.headers,
      payload: { action: "withdraw", expectedVersion: 3, reason },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: url + "/disruptions",
          headers: a.headers,
          payload: { action: "resolve", expectedVersion: 4, reason },
        })
      ).statusCode,
      409,
    );
    r = await app.inject({ url: url + "/history", headers: a.headers });
    assert.equal(r.json().items.length, 4);
    await assert.rejects(
      pool.query("DELETE FROM cabs.history WHERE record_id=$1", [id]),
      /immutable/,
    );
  } finally {
    await app.close();
  }
});
test("Cab fare estimates use exact amounts and validate coverage, versions and active references", async () => {
  const app = await buildApp(),
    a = await account(["cabs.read", "cabs.manage"]);
  const post = (kind: string, content: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/cabs/" + kind,
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: { content, code: "c-" + randomUUID(), reason },
    });
  try {
    const sid = (await post("suppliers", supplier)).json().id,
      cid = (await post("categories", category)).json().id,
      s = service(sid, cid);
    assert.equal(
      (await post("services", { ...s, availableUntil: s.availableFrom }))
        .statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...s, mode: "city" })).statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...s, includedMeters: 100001 })).statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...s, basePaise: "1.50" })).statusCode,
      422,
    );
    const id = (await post("services", s)).json().id,
      url = "/api/v1/admin/cabs/services/" + id + "/preview";
    const quote = (input: object) =>
      app.inject({ method: "POST", url, headers: a.headers, payload: input });
    let r = await quote(preview());
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().totalPaise, "18702");
    assert.equal(r.json().bookable, false);
    r = await quote({
      ...preview(),
      distanceMeters: 10000,
      waitingMinutes: 10,
    });
    assert.equal(r.json().totalPaise, "17000");
    for (const invalid of [
      { origin: "Mumbai" },
      { passengers: 5 },
      { luggage: 3 },
      { distanceMeters: 100001 },
      { pickupAt: s.availableUntil },
      { pickupAt: "2080-12-31T23:59:59Z" },
      { durationMinutes: 5 },
    ])
      assert.equal(
        (await quote({ ...preview(), ...invalid })).statusCode,
        422,
        JSON.stringify(invalid),
      );
    assert.equal(
      (await quote({ ...preview(), expectedVersion: 2 })).statusCode,
      409,
    );
    await pool.query("UPDATE cabs.records SET status='suspended' WHERE id=$1", [
      sid,
    ]);
    assert.equal((await quote(preview())).statusCode, 409);
  } finally {
    await app.close();
  }
});
test("Cab list filters precede pagination; cursors are actor/filter bound", async () => {
  const app = await buildApp(),
    a = await account(["cabs.read"]),
    b = await account(["cabs.read"]),
    prefix = randomUUID();
  try {
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO cabs.records(id,kind,code,content,created_at) VALUES($1,'suppliers',$2,$3,'2082-01-01')",
        [randomUUID(), prefix + "-" + i, { ...supplier, name: prefix }],
      );
    const url = "/api/v1/admin/cabs/suppliers?q=" + prefix,
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
      (await app.inject({ url: next + "&status=active", headers: a.headers }))
        .statusCode,
      422,
    );
    assert.equal(
      (await app.inject({ url: next, headers: b.headers })).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          url: url + "&from=2081-01-01T00:00:00Z",
          headers: a.headers,
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
test("Cab writes roll back when audit persistence fails", async () => {
  const a = await account(["cabs.read", "cabs.manage"]),
    code = "c-" + randomUUID(),
    admin = new CabAdministration(
      new PostgresCabs(new PostgresStaffAuthorization()),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    admin.create(a.id, "suppliers", randomUUID(), {
      code,
      content: supplier,
      reason,
    }),
    /Audit unavailable/,
  );
  assert.equal(
    (await pool.query("SELECT 1 FROM cabs.records WHERE code=$1", [code]))
      .rowCount,
    0,
  );
});
