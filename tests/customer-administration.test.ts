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
async function booking(owner: string) {
  const id = randomUUID(),
    r = randomUUID();
  await pool.query(
    "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1::uuid,$2,$1::text,'test','active',now()+interval '1 hour')",
    [r, owner],
  );
  await pool.query(
    "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,snapshot,created_at,confirmed_at) VALUES($1,$2,$3,100,'INR','test','{}','2076-01-02','2076-01-02')",
    [id, owner, r],
  );
  return id;
}
test("FR04 customer filters apply before pagination; cursors bind actor and filters", async () => {
  const app = await buildApp(),
    staff = await account(["customers.read"]),
    prefix = randomUUID(),
    ids: string[] = [];
  try {
    for (let i = 0; i < 27; i++) {
      const c = await account();
      ids.push(c.id);
      await pool.query(
        "INSERT INTO profiles.preferences(account_id,name,city) VALUES($1,$2,$3)",
        [c.id, prefix + " Customer", "Mumbai"],
      );
      await pool.query(
        "UPDATE identity.accounts SET created_at='2076-01-01' WHERE id=$1",
        [c.id],
      );
    }
    await booking(ids[0]);
    await booking(ids[0]);
    const get = (q: string) =>
      app.inject({
        url: "/api/v1/admin/customers?q=" + prefix + q,
        headers: staff.headers,
      });
    let r = await get("");
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 25);
    const cursor = r.json().nextCursor;
    r = await get("&after=" + encodeURIComponent(cursor));
    assert.equal(r.json().items.length, 2);
    assert.equal(
      new Set([
        ...r.json().items.map((x: any) => x.id),
        ...(await get("")).json().items.map((x: any) => x.id),
      ]).size,
      27,
    );
    assert.equal(
      (await get("&status=active&after=" + encodeURIComponent(cursor)))
        .statusCode,
      422,
    );
    assert.equal(
      (await get("&activity=repeat_confirmed")).json().items[0].id,
      ids[0],
    );
    assert.equal(
      (
        await get("&activity=has_bookings&bookingUntil=2076-01-01T00:00:00Z")
      ).json().items.length,
      0,
    );
    assert.equal(
      (await get("&activity=no_bookings"))
        .json()
        .items.some((x: any) => x.id === ids[0]),
      false,
    );
    assert.equal(
      (await get("&from=2077-01-01T00:00:00Z")).json().items.length,
      0,
    );
    assert.equal(
      (await get("&bookingFrom=2076-01-01T00:00:00Z")).statusCode,
      422,
    );
    assert.equal((await get("&sort=oldest")).json().items.length, 25);
  } finally {
    await app.close();
  }
});
test("FR04 detail and histories enforce separate permissions, mask PII and report verification honestly", async () => {
  const app = await buildApp(),
    staff = await account(["customers.read"]),
    full = await account([
      "customers.read",
      "bookings.read",
      "finance",
      "support",
    ]),
    customer = await account(),
    weak = await account(["customers.read"], false);
  try {
    const id = await booking(customer.id);
    await pool.query(
      "INSERT INTO support.cases(id,owner_id,subject,category) VALUES($1,$2,'PRIVATE SUBJECT','booking')",
      [randomUUID(), customer.id],
    );
    const path = "/api/v1/admin/customers/" + customer.id;
    let r = await app.inject({ url: path, headers: staff.headers });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().account.contact_verification, "not_recorded");
    assert.equal(r.json().profile.wallet.supported, false);
    assert(!r.body.includes(customer.id + "@fixture.invalid"));
    assert.equal(
      (await app.inject({ url: path, headers: weak.headers })).statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/customers/" + randomUUID(),
          headers: staff.headers,
        })
      ).statusCode,
      404,
    );
    for (const kind of ["bookings", "payments", "support"]) {
      assert.equal(
        (
          await app.inject({
            url: path + "/history?kind=" + kind,
            headers: staff.headers,
          })
        ).statusCode,
        403,
      );
      r = await app.inject({
        url: path + "/history?kind=" + kind,
        headers: full.headers,
      });
      assert.equal(r.statusCode, 200, r.body);
      assert(!r.body.includes("PRIVATE SUBJECT"));
      if (kind === "bookings") assert.equal(r.json().items[0].id, id);
    }
    await pool.query(
      "INSERT INTO identity.challenges(id,contact,verifier,expires_at,consumed,delivery_state) SELECT $1,contact,'test',now(),true,'accepted' FROM identity.accounts WHERE id=$2",
      [randomUUID(), customer.id],
    );
    r = await app.inject({ url: path, headers: staff.headers });
    assert.equal(r.json().account.contact_verification, "verified_legacy");
    assert.equal(r.json().account.contact_verified_at, null);
  } finally {
    await app.close();
  }
});
test("FR04 status changes capture reasons, revoke sessions, reject stale writes and privilege payloads", async () => {
  const app = await buildApp(),
    manager = await account(["customers.read", "access.manage"]),
    reader = await account(["customers.read"]),
    c = await account();
  const path = "/api/v1/admin/customers/" + c.id + "/status",
    payload = {
      expectedVersion: 1,
      status: "suspended",
      customerFlags: ["review_required"],
      reason: "Reviewed reported account abuse",
    };
  const patch = (body = payload, headers = manager.headers) =>
    app.inject({ method: "PATCH", url: path, headers, payload: body });
  try {
    assert.equal((await patch(payload, reader.headers)).statusCode, 403);
    assert.equal(
      (await patch({ ...payload, permissions: ["finance"] } as any)).statusCode,
      422,
    );
    assert.equal((await patch({ ...payload, reason: "" })).statusCode, 422);
    const r = await patch();
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [c.id],
        )
      ).rowCount,
      0,
    );
    assert.equal((await patch()).statusCode, 409);
    assert.equal(
      (
        await patch({
          ...payload,
          expectedVersion: 2,
          status: "active",
          customerFlags: [],
        })
      ).statusCode,
      200,
    );
    const row = (
      await pool.query(
        "SELECT status,is_admin,customer_flags,contact_verified_at FROM identity.accounts WHERE id=$1",
        [c.id],
      )
    ).rows[0];
    assert.equal(row.is_admin, false);
    assert.equal(row.status, "active");
    assert.deepEqual(row.customer_flags, []);
    assert.equal(row.contact_verified_at, null);
  } finally {
    await app.close();
  }
});
test("FR04 saved attendees are masked, consent-aware and unavailable without encryption configuration", async () => {
  const previous = process.env.REGISTRATION_ENCRYPTION_KEY;
  process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const app = await buildApp(),
    staff = await account(["customers.read"]),
    c = await account();
  try {
    let r = await app.inject({
      method: "PUT",
      url: "/api/v1/profile/attendees",
      headers: c.headers,
      payload: {
        expectedVersion: 0,
        consentVersion: 1,
        consent: true,
        items: [
          {
            id: randomUUID(),
            name: "Private Person",
            email: "private@fixture.invalid",
            phone: "+919876543210",
          },
        ],
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    const get = () =>
      app.inject({
        url: "/api/v1/admin/customers/" + c.id,
        headers: staff.headers,
      });
    r = await get();
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().profile.savedAttendees.items[0].name, "P***");
    assert(!r.body.includes("private@fixture.invalid"));
    assert(!r.body.includes("+919876543210"));
    delete process.env.REGISTRATION_ENCRYPTION_KEY;
    r = await get();
    assert.equal(r.json().profile.savedAttendees.available, false);
    r = await app.inject({
      method: "PUT",
      url: "/api/v1/profile/attendees",
      headers: c.headers,
      payload: {
        expectedVersion: 1,
        consentVersion: 1,
        consent: false,
        items: [],
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    r = await get();
    assert.deepEqual(r.json().profile.savedAttendees, {
      available: true,
      items: [],
    });
  } finally {
    if (previous === undefined) delete process.env.REGISTRATION_ENCRYPTION_KEY;
    else process.env.REGISTRATION_ENCRYPTION_KEY = previous;
    await app.close();
  }
});
