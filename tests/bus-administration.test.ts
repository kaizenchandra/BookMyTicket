import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { BusAdministration } from "../src/modules/buses/application/administration.ts";
import { PostgresBuses } from "../src/modules/buses/adapters/postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import type {
  Operator,
  Route,
  Service,
} from "../src/modules/buses/domain/catalogue.ts";
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
const operator: Operator = {
  name: "Test Operator",
  contactEmail: "private@fixture.invalid",
  contactPhone: "+919876543210",
  supplierName: "Test supplier",
  supplierReference: "Test contract",
  active: true,
};
const route: Route = {
  name: "Pune to Mumbai",
  origin: "Pune",
  destination: "Mumbai",
  boarding: [
    { name: "Pune Central", address: "Test station address", offsetMinutes: 0 },
  ],
  dropping: [
    {
      name: "Mumbai Central",
      address: "Test arrival address",
      offsetMinutes: 180,
    },
  ],
  active: true,
};
function service(operatorId: string, routeId: string): Service {
  return {
    name: "Morning service",
    operatorId,
    routeId,
    departure: "2081-01-01T09:00:00+05:30",
    arrival: "2081-01-01T12:00:00+05:30",
    amenities: ["Air conditioning"],
    seats: [
      {
        label: "1A",
        deck: "lower",
        row: 1,
        column: 1,
        type: "seater",
        farePaise: "50000",
      },
      {
        label: "1B",
        deck: "lower",
        row: 1,
        column: 2,
        type: "seater",
        farePaise: "60000",
      },
    ],
    cancellationPolicy:
      "Reference policy: free before 24 hours, full penalty after.",
    freeCancellationHours: 24,
    penaltyBps: 10000,
  };
}
const reason = "Reviewed operator catalogue information";
test("Bus administration supports guarded operator/route/service management and explicit unknown supplier status", async () => {
  const app = await buildApp(),
    a = await account(["buses.read", "buses.manage"]),
    reader = await account(["buses.read"]),
    weak = await account(["buses.read", "buses.manage"], false);
  const post = (
    kind: string,
    payload: Record<string, unknown>,
    who = a,
    key = randomUUID(),
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/buses/" + kind,
      headers: { ...who.headers, "idempotency-key": key },
      payload,
    });
  try {
    const body = { code: "b-" + randomUUID(), content: operator, reason };
    assert.equal((await post("operators", body, reader)).statusCode, 403);
    assert.equal((await post("operators", body, weak)).statusCode, 403);
    const key = randomUUID(),
      results = await Promise.all([
        post("operators", body, a, key),
        post("operators", body, a, key),
      ]);
    assert(
      results.every((r) => r.statusCode === 200),
      results.map((r) => r.body).join(),
    );
    const op = results[0].json().id;
    assert.equal(results[1].json().id, op);
    assert.equal(
      (
        await post(
          "operators",
          { ...body, reason: "Changed duplicate request" },
          a,
          key,
        )
      ).statusCode,
      409,
    );
    assert.equal((await post("operators", body)).statusCode, 409);
    let r = await post("routes", {
      code: "r-" + randomUUID(),
      content: route,
      reason,
    });
    assert.equal(r.statusCode, 200, r.body);
    const routeId = r.json().id,
      c = service(op.toUpperCase(), routeId.toUpperCase());
    r = await post("services", {
      code: "s-" + randomUUID(),
      content: c,
      reason,
    });
    assert.equal(r.statusCode, 200, r.body);
    const id = r.json().id,
      path = "/api/v1/admin/buses/services/" + id;
    r = await app.inject({ url: path, headers: reader.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().integration.availability, null);
    assert.equal(r.json().integration.ticketStatus, null);
    assert.equal(r.json().record.content.operatorId, op);
    assert.deepEqual(r.json().record.content.routeSnapshot, route);
    r = await app.inject({
      url: "/api/v1/admin/buses/services?operatorId=" + op,
      headers: a.headers,
    });
    assert(r.json().items.some((x: { id: string }) => x.id === id));
    const changes = await Promise.all(
      [1, 2].map((n) =>
        app.inject({
          method: "PATCH",
          url: path,
          headers: a.headers,
          payload: {
            expectedVersion: 1,
            content: { ...c, name: "Updated service " + n },
            reason,
          },
        }),
      ),
    );
    assert.deepEqual(changes.map((r) => r.statusCode).sort(), [200, 409]);
    const action = (action: string, v: number) =>
      app.inject({
        method: "POST",
        url: path + "/disruptions",
        headers: a.headers,
        payload: { action, expectedVersion: v, reason },
      });
    assert.equal((await action("resolve", 2)).statusCode, 409);
    assert.equal((await action("disrupt", 2)).statusCode, 200);
    assert.equal((await action("resolve", 3)).statusCode, 200);
    assert.equal((await action("withdraw", 4)).statusCode, 200);
    assert.equal((await action("resolve", 5)).statusCode, 409);
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: path,
          headers: a.headers,
          payload: { expectedVersion: 5, content: c, reason },
        })
      ).statusCode,
      409,
    );
    r = await app.inject({ url: path + "/history", headers: reader.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 5);
    assert.equal((await app.inject({ url: path })).statusCode, 401);
    await assert.rejects(
      pool.query("DELETE FROM buses.history WHERE record_id=$1", [id]),
      /immutable/,
    );
  } finally {
    await app.close();
  }
});
test("Bus validation rejects malformed layouts, timing, invalid references and stale policy edits", async () => {
  const app = await buildApp(),
    a = await account(["buses.read", "buses.manage"]);
  const post = (kind: string, content: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/buses/" + kind,
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: { code: "c-" + randomUUID(), content, reason },
    });
  try {
    assert.equal(
      (await post("routes", { ...route, destination: route.origin }))
        .statusCode,
      422,
    );
    assert.equal(
      (
        await post("routes", {
          ...route,
          dropping: [{ ...route.dropping[0], offsetMinutes: 0 }],
        })
      ).statusCode,
      422,
    );
    const op = (await post("operators", operator)).json().id,
      rt = (await post("routes", route)).json().id,
      c = service(op, rt);
    assert.equal(
      (await post("services", { ...c, seats: [c.seats[0], c.seats[0]] }))
        .statusCode,
      422,
    );
    assert.equal(
      (
        await post("services", {
          ...c,
          seats: [c.seats[0], { ...c.seats[0], label: "DIFFERENT" }],
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...c, arrival: c.departure })).statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...c, arrival: "2081-01-01T10:00:00+05:30" }))
        .statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...c, routeId: op })).statusCode,
      404,
    );
    assert.equal(
      (await post("services", { ...c, routeSnapshot: route })).statusCode,
      422,
    );
    await pool.query(
      "UPDATE buses.records SET status='suspended' WHERE id=$1",
      [op],
    );
    assert.equal((await post("services", c)).statusCode, 409);
  } finally {
    await app.close();
  }
});
test("Bus searches apply before pagination and bind filter cursors", async () => {
  const app = await buildApp(),
    a = await account(["buses.read"]),
    prefix = randomUUID();
  try {
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO buses.records(id,kind,code,content,created_at) VALUES($1,'operators',$2,$3,'2082-01-01')",
        [
          randomUUID(),
          prefix + "-" + i,
          { ...operator, name: prefix + " Operator" },
        ],
      );
    const get = (q: string) =>
      app.inject({
        url: "/api/v1/admin/buses/operators?q=" + prefix + q,
        headers: a.headers,
      });
    let r = await get("");
    assert.equal(r.statusCode, 200, r.body);
    const first = r.json();
    assert.equal(first.items.length, 25);
    r = await get("&after=" + encodeURIComponent(first.nextCursor));
    assert.equal(r.json().items.length, 2);
    assert.equal(
      new Set([...first.items, ...r.json().items].map((x) => x.id)).size,
      27,
    );
    assert.equal(
      (
        await get(
          "&status=active&after=" + encodeURIComponent(first.nextCursor),
        )
      ).statusCode,
      422,
    );
    assert.equal((await get("&from=2081-01-01T00:00:00Z")).statusCode, 422);
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/buses/routes/" + first.items[0].id,
          headers: a.headers,
        })
      ).statusCode,
      404,
    );
  } finally {
    await app.close();
  }
});
test("Bus catalogue changes roll back on audit failure", async () => {
  const a = await account(["buses.read", "buses.manage"]),
    code = "b-" + randomUUID(),
    service = new BusAdministration(
      new PostgresBuses(new PostgresStaffAuthorization()),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    service.create(a.id, "operators", randomUUID(), {
      code,
      content: operator,
      reason,
    }),
    /Audit unavailable/,
  );
  assert.equal(
    (await pool.query("SELECT 1 FROM buses.records WHERE code=$1", [code]))
      .rowCount,
    0,
  );
});
