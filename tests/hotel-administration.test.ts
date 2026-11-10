import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { PropertyAdministration } from "../src/modules/hotels/application/administration.ts";
import { PostgresProperties } from "../src/modules/hotels/adapters/postgres.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import {
  completeness,
  type Content,
} from "../src/modules/hotels/domain/property.ts";
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
function content(): Content {
  return {
    name: "Property " + randomUUID(),
    kind: "homestay",
    description:
      "A carefully maintained homestay with courtyard and accessible rooms.",
    city: "Pune",
    address: "Test address",
    latitude: 18.52,
    longitude: 73.85,
    contactEmail: "private@fixture.invalid",
    contactPhone: "+919876543210",
    supplier: {
      name: "Private contracting party",
      reference: "PRIVATE-CONTRACT",
    },
    images: [{ url: "https://example.com/property.jpg", alt: "Courtyard" }],
    amenities: ["Wi-Fi"],
    facilities: ["Accessible entry"],
    houseRules: "No smoking indoors",
    checkIn: "14:00",
    checkOut: "11:00",
    cancellationPolicy: "Free cancellation until the agreed booking deadline.",
  };
}
test("Hotel lifecycle validates completeness, gates actions, hides drafts and removes edited/suspended public listings", async () => {
  const app = await buildApp(),
    editor = await account(["hotels.read", "hotels.manage"]),
    reviewer = await account(["hotels.read", "hotels.review"]),
    weak = await account(["hotels.read", "hotels.manage"], false),
    c = content(),
    code = "h-" + randomUUID();
  try {
    const create = (payload: Record<string, unknown>, who = editor) =>
      app.inject({
        method: "POST",
        url: "/api/v1/admin/hotels",
        headers: { ...who.headers, "idempotency-key": randomUUID() },
        payload,
      });
    assert.equal(
      (
        await create(
          { code, content: c, reason: "Onboard contracted property" },
          weak,
        )
      ).statusCode,
      403,
    );
    let r = await create({
      code,
      content: { ...c, description: "" },
      reason: "Onboard contracted property",
    });
    assert.equal(r.statusCode, 200, r.body);
    const id = r.json().id,
      path = "/api/v1/admin/hotels/" + id;
    const action = (action: string, expectedVersion: number, who = reviewer) =>
      app.inject({
        method: "POST",
        url: path + "/actions",
        headers: who.headers,
        payload: {
          action,
          expectedVersion,
          reason: "Reviewed supplied property content",
        },
      });
    assert.equal((await action("submit", 1, editor)).statusCode, 422);
    r = await app.inject({
      method: "PATCH",
      url: path,
      headers: editor.headers,
      payload: {
        expectedVersion: 1,
        content: c,
        reason: "Complete property information",
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await action("approve", 2)).statusCode, 409);
    assert.equal((await action("submit", 2, editor)).statusCode, 200);
    assert.equal((await action("approve", 3, editor)).statusCode, 403);
    const publicGet = () =>
      app.inject({ url: "/api/v1/hotels?q=" + code + "&state=draft" });
    assert.equal((await publicGet()).json().items.length, 0);
    assert.equal((await action("approve", 3)).statusCode, 200);
    r = await publicGet();
    assert.equal(r.json().items.length, 1);
    assert.equal(r.json().items[0].bookable, false);
    assert(!r.body.includes("private@"));
    assert(!r.body.includes("PRIVATE-CONTRACT"));
    assert(!r.body.includes("+919876543210"));
    assert.equal((await action("suspend", 4)).statusCode, 200);
    assert.equal((await publicGet()).json().items.length, 0);
    assert.equal((await action("delist", 5)).statusCode, 200);
    assert.equal((await action("reopen", 6)).statusCode, 200);
    assert.equal((await action("submit", 7, editor)).statusCode, 200);
    assert.equal((await action("reject", 8)).statusCode, 200);
    assert.equal((await action("submit", 9, editor)).statusCode, 200);
    assert.equal((await action("approve", 10)).statusCode, 200);
    r = await app.inject({
      method: "PATCH",
      url: path,
      headers: editor.headers,
      payload: {
        expectedVersion: 11,
        content: {
          ...c,
          cancellationPolicy: "Updated policy requiring a fresh review.",
        },
        reason: "Update cancellation terms",
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().state, "draft");
    assert.equal((await publicGet()).json().items.length, 0);
    r = await app.inject({ url: path + "/history", headers: reviewer.headers });
    assert.equal(r.json().items.length, 12);
    assert.equal(
      r.json().items[0].snapshot.content.cancellationPolicy,
      "Updated policy requiring a fresh review.",
    );
    assert.equal(
      r.json().items[1].snapshot.content.cancellationPolicy,
      c.cancellationPolicy,
    );
    await assert.rejects(
      pool.query("DELETE FROM hotels.revisions WHERE property_id=$1", [id]),
      /immutable/,
    );
    assert.equal(
      (await app.inject({ url: path, headers: {} })).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
test("Hotel edits serialize, create replays deduplicate and invalid media/locations are rejected", async () => {
  const app = await buildApp(),
    editor = await account(["hotels.read", "hotels.manage"]),
    c = content(),
    payload = {
      code: "h-" + randomUUID(),
      content: c,
      reason: "Onboard contracted property",
    },
    key = randomUUID();
  const create = (body = payload) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/hotels",
      headers: { ...editor.headers, "idempotency-key": key },
      payload: body,
    });
  try {
    const results = await Promise.all([create(), create()]);
    assert(
      results.every((r) => r.statusCode === 200),
      results.map((r) => r.body).join(),
    );
    const id = results[0].json().id;
    assert.equal(results[1].json().id, id);
    assert.equal(
      (await create({ ...payload, reason: "Different request payload" }))
        .statusCode,
      409,
    );
    const edits = await Promise.all(
      [1, 2].map((n) =>
        app.inject({
          method: "PATCH",
          url: "/api/v1/admin/hotels/" + id,
          headers: editor.headers,
          payload: {
            expectedVersion: 1,
            content: { ...c, name: "Changed " + n },
            reason: "Update property display name",
          },
        }),
      ),
    );
    assert.deepEqual(edits.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal(
      (
        await create({
          ...payload,
          content: {
            ...c,
            images: [{ url: "javascript:alert(1)", alt: "Invalid" }],
          },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (await create({ ...payload, content: { ...c, latitude: 100 } }))
        .statusCode,
      422,
    );
    assert.equal(
      (await app.inject({ url: "/api/v1/hotels?south=1" })).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/admin/hotels/" + randomUUID(),
          headers: editor.headers,
        })
      ).statusCode,
      404,
    );
  } finally {
    await app.close();
  }
});
test("Hotel directory filters before pagination and public geographic search excludes unpublished records", async () => {
  const app = await buildApp(),
    staff = await account(["hotels.read"]),
    prefix = randomUUID();
  try {
    for (let i = 0; i < 27; i++) {
      const c = { ...content(), name: prefix + " " + i };
      await pool.query(
        "INSERT INTO hotels.properties(id,code,content,state,latitude,longitude,created_at) VALUES($1,$2,$3,'published',18.52,73.85,'2079-01-01')",
        [randomUUID(), prefix + "-" + i, c],
      );
    }
    const get = (q: string) =>
      app.inject({
        url: "/api/v1/admin/hotels?q=" + prefix + q,
        headers: staff.headers,
      });
    let r = await get("");
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().items.length, 25);
    const cursor = encodeURIComponent(r.json().nextCursor),
      ids = r.json().items.map((p: any) => p.id);
    r = await get("&after=" + cursor);
    assert.equal(r.json().items.length, 2);
    assert.equal(
      new Set([...ids, ...r.json().items.map((p: any) => p.id)]).size,
      27,
    );
    assert.equal((await get("&city=Pune&after=" + cursor)).statusCode, 422);
    r = await app.inject({
      url: "/api/v1/hotels?q=" + prefix + "&south=18&north=19&west=73&east=74",
    });
    assert.equal(r.json().items.length, 25);
    r = await app.inject({
      url: "/api/v1/hotels?q=" + prefix + "&south=0&north=1&west=0&east=1",
    });
    assert.equal(r.json().items.length, 0);
  } finally {
    await app.close();
  }
});
test("Hotel revision and property changes roll back together on audit failure", async () => {
  const staff = await account(["hotels.read", "hotels.manage"]),
    code = "h-" + randomUUID(),
    service = new PropertyAdministration(
      new PostgresProperties(new PostgresStaffAuthorization()),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  assert.equal(completeness(content()).complete, true);
  await assert.rejects(
    service.create(staff.id, randomUUID(), {
      code,
      content: content(),
      reason: "Create property for rollback test",
    }),
    /Audit unavailable/,
  );
  assert.equal(
    (await pool.query("SELECT 1 FROM hotels.properties WHERE code=$1", [code]))
      .rowCount,
    0,
  );
});
