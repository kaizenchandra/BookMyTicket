import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { HotelInventory } from "../src/modules/inventory/application/hotel.ts";
import { PostgresHotelInventory } from "../src/modules/inventory/adapters/hotel.ts";
import { PostgresHotelInventoryTarget } from "../src/modules/hotels/adapters/inventory-target.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import { roomNight } from "../src/modules/inventory/domain/hotel.ts";
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
async function fixture() {
  const property = randomUUID(),
    room = randomUUID(),
    plan = randomUUID();
  await pool.query(
    "INSERT INTO hotels.properties(id,code,content,state) VALUES($1::uuid,$1::text,'{}','published')",
    [property],
  );
  await pool.query(
    "INSERT INTO inventory.hotel_rooms(id,property_id,code,name,max_guests) VALUES($1,$2,'double','Double',4)",
    [room, property],
  );
  await pool.query(
    "INSERT INTO inventory.hotel_plans(id,room_id,name,refundable,policy,base_paise,included_guests,extra_guest_paise,min_stay) VALUES($1,$2,'Flexible',true,'Refundable before deadline',10000,2,1000,1)",
    [plan, room],
  );
  await pool.query(
    "INSERT INTO inventory.hotel_days SELECT $1,d,1,false,false FROM generate_series('2080-01-01'::date,'2080-01-03'::date,interval '1 day') d",
    [room],
  );
  return { property, room, plan };
}
const reason = "Reviewed inventory allocation request";
const hold = (plan: string) => ({
  planId: plan,
  checkIn: "2080-01-01",
  checkOut: "2080-01-03",
  quantity: 1,
  guestsPerRoom: 3,
  reason,
});
test("Hotel holds prevent concurrent overselling across plans and preserve idempotent expiry/quotes", async () => {
  const app = await buildApp(),
    a = await account(["hotels.read", "hotels.manage"]),
    b = await account(["hotels.read", "hotels.manage"]),
    f = await fixture(),
    second = randomUUID();
  await pool.query(
    "INSERT INTO inventory.hotel_plans(id,room_id,name,refundable,policy,base_paise,included_guests,extra_guest_paise,min_stay) VALUES($1,$2,'Advance',false,'Non-refundable plan',9000,2,1000,1)",
    [second, f.room],
  );
  try {
    const key = randomUUID(),
      post = (actor = a, plan = f.plan, k = key) =>
        app.inject({
          method: "POST",
          url: `/api/v1/admin/hotel-rooms/${f.room}/holds`,
          headers: { ...actor.headers, "idempotency-key": k },
          payload: hold(plan),
        });
    let r = await post();
    assert.equal(r.statusCode, 200, r.body);
    const first = r.json();
    assert.equal(first.quote.totalPaise, "22000");
    r = await post();
    assert.equal(r.json().id, first.id);
    assert.equal(r.json().expires_at, first.expires_at);
    assert.equal((await post(a, second)).statusCode, 409);
    assert.equal((await post(b, second, randomUUID())).statusCode, 409);
    await pool.query(
      "UPDATE inventory.hotel_allocations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [first.id],
    );
    const races = await Promise.all([
      post(a, f.plan, randomUUID()),
      post(b, second, randomUUID()),
    ]);
    assert.deepEqual(races.map((x) => x.statusCode).sort(), [200, 409]);
    const winner = races.find((x) => x.statusCode === 200)!.json();
    const action = (id: string, action: string) =>
      app.inject({
        method: "POST",
        url: `/api/v1/admin/hotel-rooms/${f.room}/allocations/${id}/actions`,
        headers: a.headers,
        payload: { action, reason },
      });
    assert.equal((await action(first.id, "reserve")).statusCode, 409);
    assert.equal((await action(first.id, "release")).statusCode, 200);
    assert.equal((await action(winner.id, "reserve")).statusCode, 200);
    assert.equal((await action(winner.id, "reserve")).statusCode, 200);
    assert.equal((await post(b, second, randomUUID())).statusCode, 409);
    assert.equal((await action(winner.id, "release")).statusCode, 200);
    assert.equal((await action(winner.id, "reserve")).statusCode, 409);
    assert.equal((await post(b, second, randomUUID())).statusCode, 200);
  } finally {
    await app.close();
  }
});
test("Hotel multi-night hold rejects whole stay on unavailable nights and all restriction/occupancy failures", async () => {
  const app = await buildApp(),
    a = await account(["hotels.read", "hotels.manage"]),
    f = await fixture();
  try {
    const post = (payload = hold(f.plan)) =>
      app.inject({
        method: "POST",
        url: `/api/v1/admin/hotel-rooms/${f.room}/holds`,
        headers: { ...a.headers, "idempotency-key": randomUUID() },
        payload,
      });
    await pool.query(
      "UPDATE inventory.hotel_days SET capacity=0 WHERE room_id=$1 AND day='2080-01-02'",
      [f.room],
    );
    assert.equal((await post()).statusCode, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM inventory.hotel_allocations WHERE room_id=$1",
          [f.room],
        )
      ).rowCount,
      0,
    );
    await pool.query(
      "UPDATE inventory.hotel_days SET capacity=1,stop_sell=true WHERE room_id=$1",
      [f.room],
    );
    assert.equal((await post()).statusCode, 409);
    await pool.query(
      "UPDATE inventory.hotel_days SET stop_sell=false,blackout=true WHERE room_id=$1",
      [f.room],
    );
    assert.equal((await post()).statusCode, 409);
    await pool.query(
      "UPDATE inventory.hotel_days SET blackout=false WHERE room_id=$1",
      [f.room],
    );
    assert.equal(
      (await post({ ...hold(f.plan), guestsPerRoom: 5 })).statusCode,
      422,
    );
    await pool.query(
      "UPDATE inventory.hotel_plans SET min_stay=3 WHERE id=$1",
      [f.plan],
    );
    assert.equal((await post()).statusCode, 409);
    await pool.query(
      "UPDATE inventory.hotel_plans SET min_stay=1 WHERE id=$1",
      [f.plan],
    );
    assert.equal(
      (
        await post({
          ...hold(f.plan),
          checkIn: "2000-01-01",
          checkOut: "2000-01-03",
        })
      ).statusCode,
      422,
    );
    await pool.query(
      "UPDATE hotels.properties SET state='suspended' WHERE id=$1",
      [f.property],
    );
    assert.equal((await post()).statusCode, 409);
  } finally {
    await app.close();
  }
});
test("Bulk calendars protect committed capacity, version-check edits and snapshot occupancy/seasonal/promo pricing", async () => {
  const app = await buildApp(),
    a = await account(["hotels.read", "hotels.manage", "pricing"]),
    reader = await account(["hotels.read"]),
    f = await fixture(),
    base = `/api/v1/admin/hotel-rooms/${f.room}`,
    bulk = {
      planId: f.plan,
      expectedVersion: 1,
      from: "2080-01-01",
      until: "2080-01-03",
      capacity: 2,
      stopSell: false,
      blackout: false,
      basePaise: "20000",
      discountBps: 1000,
      minStay: 2,
      reason,
    };
  try {
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: base + "/calendar",
          headers: reader.headers,
          payload: bulk,
        })
      ).statusCode,
      403,
    );
    let r = await app.inject({
      method: "PUT",
      url: base + "/calendar",
      headers: a.headers,
      payload: bulk,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: base + "/calendar",
          headers: a.headers,
          payload: bulk,
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "POST",
      url: base + "/holds",
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: hold(f.plan),
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().quote.totalPaise, "37800");
    r = await app.inject({
      method: "PUT",
      url: base + "/calendar",
      headers: a.headers,
      payload: { ...bulk, expectedVersion: 2, capacity: 0 },
    });
    assert.equal(r.statusCode, 409);
    r = await app.inject({
      method: "POST",
      url: base + "/reconciliation",
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: {
        planId: f.plan,
        expectedVersion: 2,
        from: bulk.from,
        until: bulk.until,
        observedCapacity: 1,
        reason,
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().discrepancies.length, 2);
    assert.equal(r.json().inventoryChanged, false);
    r = await app.inject({
      url:
        base +
        `/calendar?planId=${f.plan}&from=${bulk.from}&until=${bulk.until}`,
      headers: reader.headers,
    });
    assert.equal(r.json().nights[0].capacity, 2);
    assert.equal(r.json().nights[0].used, 1);
    assert.equal(
      (await app.inject({ url: base + "/history", headers: reader.headers }))
        .statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          url: base + "/allocations",
          headers: reader.headers,
        })
      ).json().items.length,
      1,
    );
    assert.equal(roomNight("1", "0", 1, 1, 5000, 2), "2");
  } finally {
    await app.close();
  }
});
test("Hotel inventory holds roll back on audit failure", async () => {
  const a = await account(["hotels.read", "hotels.manage"]),
    f = await fixture(),
    service = new HotelInventory(
      new PostgresHotelInventory(
        new PostgresStaffAuthorization(),
        new PostgresHotelInventoryTarget(),
      ),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    service.hold(a.id, f.room, randomUUID(), hold(f.plan)),
    /Audit unavailable/,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT 1 FROM inventory.hotel_allocations WHERE room_id=$1",
        [f.room],
      )
    ).rowCount,
    0,
  );
});
test("Room and rate-plan management enforces occupancy, versions, permissions and idempotent creation", async () => {
  const app = await buildApp(),
    a = await account(["hotels.read", "hotels.manage", "pricing"]),
    weak = await account(["hotels.read", "hotels.manage", "pricing"], false),
    f = await fixture();
  try {
    const roomBody = {
        code: "suite-" + randomUUID(),
        name: "Family suite",
        maxGuests: 4,
        reason,
      },
      key = randomUUID(),
      create = () =>
        app.inject({
          method: "POST",
          url: `/api/v1/admin/hotels/${f.property}/rooms`,
          headers: { ...a.headers, "idempotency-key": key },
          payload: roomBody,
        });
    let r = await create();
    assert.equal(r.statusCode, 200, r.body);
    const room = r.json().id;
    assert.equal((await create()).json().id, room);
    const planBody = {
        name: "Standard",
        refundable: false,
        policy: "No refund after allocation",
        basePaise: "50000",
        includedGuests: 2,
        extraGuestPaise: "1000",
        minStay: 1,
        active: true,
        expectedVersion: 1,
        reason,
      },
      planKey = randomUUID(),
      planCreate = () =>
        app.inject({
          method: "POST",
          url: `/api/v1/admin/hotel-rooms/${room}/plans`,
          headers: { ...a.headers, "idempotency-key": planKey },
          payload: planBody,
        });
    r = await planCreate();
    assert.equal(r.statusCode, 200, r.body);
    const plan = r.json().id;
    assert.equal((await planCreate()).json().id, plan);
    r = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/hotel-rooms/${room}/plans/${plan}`,
      headers: a.headers,
      payload: {
        ...planBody,
        expectedVersion: 2,
        planVersion: 1,
        refundable: true,
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/hotel-rooms/${room}`,
          headers: a.headers,
          payload: {
            name: "Updated suite",
            maxGuests: 1,
            active: true,
            expectedVersion: 3,
            reason,
          },
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/hotel-rooms/${room}`,
      headers: a.headers,
      payload: {
        name: "Updated suite",
        maxGuests: 4,
        active: false,
        expectedVersion: 3,
        reason,
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    r = await app.inject({
      url: `/api/v1/admin/hotels/${f.property}/rooms`,
      headers: a.headers,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      r.json().items.find((x: { id: string }) => x.id === room).version,
      4,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/v1/admin/hotels/${f.property}/rooms`,
          headers: weak.headers,
        })
      ).statusCode,
      403,
    );
    r = await app.inject({
      method: "POST",
      url: `/api/v1/admin/hotel-rooms/${room}/holds`,
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: hold(f.plan),
    });
    assert.equal(r.statusCode, 404);
  } finally {
    await app.close();
  }
});
