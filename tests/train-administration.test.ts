import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { TrainAdministration } from "../src/modules/trains/application/administration.ts";
import { PostgresTrains } from "../src/modules/trains/adapters/postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import type {
  Station,
  Route,
  Service,
} from "../src/modules/trains/domain/catalogue.ts";
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
function station(): Station {
  return {
    name: "Fixture station",
    stationCode: "S" + randomBytes(4).toString("hex").toUpperCase(),
    city: "Pune",
    active: true,
  };
}
function route(a: string, b: string): Route {
  return {
    name: "Fixture route",
    active: true,
    stops: [
      {
        stationId: a,
        arrivalMinutes: 0,
        departureMinutes: 0,
        boarding: true,
        alighting: false,
      },
      {
        stationId: b,
        arrivalMinutes: 180,
        departureMinutes: 180,
        boarding: false,
        alighting: true,
      },
    ],
  };
}
function service(routeId: string): Service {
  return {
    name: "Fixture train",
    trainNumber: "12345",
    routeId,
    departure: "2083-01-01T09:00:00+05:30",
    arrival: "2083-01-01T12:00:00+05:30",
    classes: [{ code: "C1", name: "Fixture travel class" }],
    providerReference: "Local reference only",
    operationalNotes: "Not a live provider schedule",
  };
}
const reason = "Reviewed train catalogue information";
test("Train catalogue supports guarded station/route/schedule management and unavailable provider states", async () => {
  const app = await buildApp(),
    a = await account(["trains.read", "trains.manage"]),
    reader = await account(["trains.read"]),
    weak = await account(["trains.read", "trains.manage"], false);
  const post = (
    kind: string,
    content: unknown,
    who = a,
    key = randomUUID(),
    code = "t-" + randomUUID(),
  ) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/trains/" + kind,
      headers: { ...who.headers, "idempotency-key": key },
      payload: { code, content, reason },
    });
  try {
    const s = station(),
      key = randomUUID(),
      code = "t-" + randomUUID();
    assert.equal((await post("stations", s, reader)).statusCode, 403);
    assert.equal((await post("stations", s, weak)).statusCode, 403);
    const responses = await Promise.all([
      post("stations", s, a, key, code),
      post("stations", s, a, key, code),
    ]);
    assert(
      responses.every((r) => r.statusCode === 200),
      responses.map((r) => r.body).join(),
    );
    const origin = responses[0].json().id;
    assert.equal(responses[1].json().id, origin);
    assert.equal(
      (await post("stations", { ...s, name: "Changed" }, a, key, code))
        .statusCode,
      409,
    );
    assert.equal((await post("stations", s)).statusCode, 409);
    const destination = (await post("stations", station())).json().id;
    let r = await post("routes", route(origin.toUpperCase(), destination));
    assert.equal(r.statusCode, 200, r.body);
    const routeId = r.json().id,
      c = service(routeId.toUpperCase());
    r = await post("services", c);
    assert.equal(r.statusCode, 200, r.body);
    const id = r.json().id,
      path = "/api/v1/admin/trains/services/" + id;
    r = await app.inject({ url: path, headers: reader.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().record.content.routeId, routeId);
    for (const field of [
      "availability",
      "fare",
      "pnr",
      "bookingStatus",
      "waitlistStatus",
      "cancellationStatus",
      "refundStatus",
    ])
      assert.equal(r.json().integration[field], null);
    assert.equal(r.json().integration.bookable, false);
    assert.equal(
      r.json().record.content.routeSnapshot.stops[0].station.code,
      s.stationCode,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/admin/trains/stations/" + origin,
          headers: a.headers,
          payload: {
            content: { ...s, stationCode: "DIFFERENT" },
            expectedVersion: 1,
            reason,
          },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/v1/admin/trains/stations/" + origin,
          headers: a.headers,
          payload: {
            content: { ...s, name: "Renamed station" },
            expectedVersion: 1,
            reason,
          },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await app.inject({ url: path, headers: a.headers })).json().record
        .content.routeSnapshot.stops[0].station.name,
      s.name,
    );
    const edits = await Promise.all(
      [1, 2].map((n) =>
        app.inject({
          method: "PATCH",
          url: path,
          headers: a.headers,
          payload: {
            content: { ...c, name: "Updated train " + n },
            expectedVersion: 1,
            reason,
          },
        }),
      ),
    );
    assert.deepEqual(edits.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal(
      (await app.inject({ url: path, headers: a.headers })).json().record
        .content.routeSnapshot.stops[0].station.name,
      "Renamed station",
    );
    const action = (action: string, v: number) =>
      app.inject({
        method: "POST",
        url: path + "/incidents",
        headers: a.headers,
        payload: { action, expectedVersion: v, reason },
      });
    assert.equal((await action("resolve", 2)).statusCode, 409);
    assert.equal((await action("disrupt", 2)).statusCode, 200);
    assert.equal((await action("resolve", 3)).statusCode, 200);
    assert.equal((await action("withdraw", 4)).statusCode, 200);
    assert.equal((await action("resolve", 5)).statusCode, 409);
    r = await app.inject({ url: path + "/history", headers: reader.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 5);
    await assert.rejects(
      pool.query("DELETE FROM trains.history WHERE record_id=$1", [id]),
      /immutable/,
    );
    assert.equal((await app.inject({ url: path })).statusCode, 401);
  } finally {
    await app.close();
  }
});
test("Train validation enforces station timing, active references, distinct travel classes and schedule duration", async () => {
  const app = await buildApp(),
    a = await account(["trains.read", "trains.manage"]);
  const post = (kind: string, content: unknown) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/trains/" + kind,
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: { code: "t-" + randomUUID(), content, reason },
    });
  try {
    const origin = (await post("stations", station())).json().id,
      destination = (await post("stations", station())).json().id,
      rt = route(origin, destination);
    assert.equal(
      (
        await post("routes", {
          ...rt,
          stops: [{ ...rt.stops[0], departureMinutes: 2 }, rt.stops[1]],
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await post("routes", {
          ...rt,
          stops: [rt.stops[0], { ...rt.stops[1], arrivalMinutes: 0 }],
        })
      ).statusCode,
      422,
    );
    assert.equal((await post("routes", route(origin, origin))).statusCode, 422);
    const routeId = (await post("routes", rt)).json().id,
      c = service(routeId);
    assert.equal(
      (await post("services", { ...c, classes: [c.classes[0], c.classes[0]] }))
        .statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...c, arrival: "2083-01-01T11:59:00+05:30" }))
        .statusCode,
      422,
    );
    assert.equal(
      (await post("services", { ...c, routeId: origin })).statusCode,
      404,
    );
    assert.equal(
      (await post("services", { ...c, routeSnapshot: rt })).statusCode,
      422,
    );
    await pool.query(
      "UPDATE trains.records SET status='suspended' WHERE id=$1",
      [origin],
    );
    assert.equal((await post("services", c)).statusCode, 409);
  } finally {
    await app.close();
  }
});
test("Train searches paginate before limits, bind cursors and accept only applicable schedule filters", async () => {
  const app = await buildApp(),
    a = await account(["trains.read"]),
    prefix = randomUUID();
  try {
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO trains.records(id,kind,code,content,created_at) VALUES($1,'stations',$2,$3,'2084-01-01')",
        [
          randomUUID(),
          prefix + "-" + i,
          { ...station(), name: prefix + " Station" },
        ],
      );
    const get = (q: string) =>
      app.inject({
        url: "/api/v1/admin/trains/stations?q=" + prefix + q,
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
    assert.equal((await get("&trainNumber=12345")).statusCode, 422);
    assert.equal(
      (
        await app.inject({
          url:
            "/api/v1/admin/trains/stations/" +
            first.items[0].id +
            "/history?before=9999999999999999999",
          headers: a.headers,
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
test("Train catalogue changes roll back on audit failure", async () => {
  const a = await account(["trains.read", "trains.manage"]),
    code = "t-" + randomUUID(),
    service = new TrainAdministration(
      new PostgresTrains(new PostgresStaffAuthorization()),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    service.create(a.id, "stations", randomUUID(), {
      code,
      content: station(),
      reason,
    }),
    /Audit unavailable/,
  );
  assert.equal(
    (await pool.query("SELECT 1 FROM trains.records WHERE code=$1", [code]))
      .rowCount,
    0,
  );
});
