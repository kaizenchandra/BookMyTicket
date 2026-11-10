import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { PackageAdministration } from "../src/modules/packages/application/administration.ts";
import { PostgresPackages } from "../src/modules/packages/adapters/postgres.ts";
import { PostgresPackageAllotments } from "../src/modules/inventory/adapters/package-allotments.ts";
import { PostgresStaffAuthorization } from "../src/modules/identity/adapters/staff-authorization.ts";
import {
  packagePrice,
  type Definition,
} from "../src/modules/packages/domain/package.ts";
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
function definition(): Definition {
  return {
    name: "Package " + randomUUID(),
    description:
      "A two-day holiday itinerary with contracted accommodation and guided activities.",
    destinations: ["Pune"],
    itinerary: [
      { day: 1, title: "Arrival", description: "Check in" },
      { day: 2, title: "Explore", description: "Guided visit" },
    ],
    inclusions: ["Accommodation"],
    exclusions: ["Flights"],
    images: [{ url: "https://example.com/package.jpg", alt: "Destination" }],
    departures: [{ start: "2085-01-01", end: "2085-01-02" }],
    maxAdults: 4,
    maxChildren: 2,
    maxGuests: 5,
    childMaxAge: 12,
    childPolicy: "Children up to age 12 use the configured child price.",
    cancellationPolicy: "Reference policy subject to confirmed supplier terms.",
    components: [
      {
        id: "hotel",
        name: "Hotel stay",
        kind: "hotel",
        supplierReference: "PRIVATE-CONTRACT",
        adultPaise: "10000",
        childPaise: "5000",
        fixedPaise: "1000",
      },
    ],
    addons: [
      { id: "tour", name: "Guided tour", pricePaise: "2000", basis: "person" },
    ],
    markupBps: 1000,
    feePaise: "500",
  };
}
const reason = "Reviewed package planning information";
test("Package lifecycle validates publication and protects private costs/supplier references", async () => {
  const app = await buildApp(),
    editor = await account(["packages.read", "packages.manage"]),
    reviewer = await account(["packages.read", "packages.review"]),
    d = definition(),
    code = "p-" + randomUUID();
  try {
    let r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/packages",
      headers: { ...editor.headers, "idempotency-key": randomUUID() },
      payload: { code, content: d, reason },
    });
    assert.equal(r.statusCode, 200, r.body);
    const id = r.json().id,
      path = "/api/v1/admin/packages/" + id;
    const action = (action: string, expectedVersion: number, who = reviewer) =>
      app.inject({
        method: "POST",
        url: path + "/actions",
        headers: who.headers,
        payload: { action, expectedVersion, reason },
      });
    const published = () =>
      app.inject({
        url: "/api/v1/holiday-packages?q=" + code + "&state=draft",
      });
    assert.equal((await published()).json().items.length, 0);
    assert.equal((await action("approve", 1)).statusCode, 409);
    assert.equal((await action("submit", 1, editor)).statusCode, 200);
    assert.equal((await action("approve", 2, editor)).statusCode, 403);
    assert.equal((await action("approve", 2)).statusCode, 200);
    r = await published();
    assert.equal(r.json().items.length, 1);
    assert(!r.body.includes("PRIVATE-CONTRACT"));
    assert(!r.body.includes("adultPaise"));
    assert(!r.body.includes("markupBps"));
    assert.equal(r.json().items[0].bookable, false);
    r = await app.inject({
      method: "PATCH",
      url: path,
      headers: editor.headers,
      payload: {
        content: { ...d, name: "Updated package" },
        expectedVersion: 3,
        reason,
      },
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await published()).json().items.length, 0);
    assert.equal((await action("submit", 4, editor)).statusCode, 200);
    assert.equal((await action("reject", 5)).statusCode, 200);
    assert.equal((await action("submit", 6, editor)).statusCode, 200);
    assert.equal((await action("approve", 7)).statusCode, 200);
    assert.equal((await action("unpublish", 8)).statusCode, 200);
    assert.equal((await published()).json().items.length, 0);
    r = await app.inject({ url: path + "/history", headers: reviewer.headers });
    assert.equal(r.json().items.length, 9);
    await assert.rejects(
      pool.query("DELETE FROM packages.history WHERE package_id=$1", [id]),
      /immutable/,
    );
    assert.equal((await app.inject({ url: path })).statusCode, 401);
  } finally {
    await app.close();
  }
});
test("Package prices honor children/add-ons and version-bound allotments without claiming reservations", async () => {
  const app = await buildApp(),
    a = await account(["packages.read", "packages.manage"]),
    d = definition();
  try {
    const id = (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/packages",
          headers: { ...a.headers, "idempotency-key": randomUUID() },
          payload: { code: "p-" + randomUUID(), content: d, reason },
        })
      ).json().id,
      path = "/api/v1/admin/packages/" + id,
      preview = {
        departure: "2085-01-01",
        adults: 2,
        childAges: [8],
        addonIds: ["tour"],
      };
    let r = await app.inject({
      method: "POST",
      url: path + "/preview",
      headers: a.headers,
      payload: preview,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(r.json().totalPaise, "35100");
    assert.equal(r.json().planningLimit, null);
    assert.equal(r.json().bookable, false);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/preview",
          headers: a.headers,
          payload: { ...preview, childAges: [13] },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: path + "/preview",
          headers: a.headers,
          payload: { ...preview, addonIds: ["missing"] },
        })
      ).statusCode,
      422,
    );
    const allotment = {
      departure: preview.departure,
      expectedVersion: 1,
      allotmentVersion: 0,
      capacity: 10,
      components: [{ id: "hotel", capacity: 2 }],
      reason,
    };
    r = await app.inject({
      method: "PUT",
      url: path + "/allotments",
      headers: a.headers,
      payload: allotment,
    });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: path + "/allotments",
          headers: a.headers,
          payload: allotment,
        })
      ).statusCode,
      409,
    );
    r = await app.inject({
      method: "POST",
      url: path + "/preview",
      headers: a.headers,
      payload: preview,
    });
    assert.equal(r.json().planningLimit, 2);
    assert.equal(r.json().withinPlanningLimit, false);
    assert.equal(r.json().availability, "unknown");
    await app.inject({
      method: "PATCH",
      url: path,
      headers: a.headers,
      payload: {
        content: { ...d, description: d.description + " Updated" },
        expectedVersion: 1,
        reason,
      },
    });
    r = await app.inject({
      method: "POST",
      url: path + "/preview",
      headers: a.headers,
      payload: preview,
    });
    assert.equal(r.json().planningLimit, null);
    r = await app.inject({ url: path + "/history", headers: a.headers });
    assert(
      r
        .json()
        .items.some(
          (h: any) => h.snapshot.allotmentChange?.after.capacity === 10,
        ),
    );
    assert.equal(
      packagePrice(
        {
          ...d,
          components: [
            {
              ...d.components[0],
              adultPaise: "1",
              childPaise: "0",
              fixedPaise: "0",
            },
          ],
          markupBps: 5000,
          feePaise: "0",
        },
        1,
        0,
        [],
      ).totalPaise,
      "2",
    );
  } finally {
    await app.close();
  }
});
test("Package creation replay, validation, stale edits and filtered pagination remain correct", async () => {
  const app = await buildApp(),
    a = await account(["packages.read", "packages.manage"]),
    weak = await account(["packages.read", "packages.manage"], false),
    d = definition(),
    code = "p-" + randomUUID(),
    key = randomUUID(),
    post = (content = d, who = a) =>
      app.inject({
        method: "POST",
        url: "/api/v1/admin/packages",
        headers: { ...who.headers, "idempotency-key": key },
        payload: { code, content, reason },
      });
  try {
    assert.equal((await post(d, weak)).statusCode, 403);
    const results = await Promise.all([post(), post()]);
    assert(results.every((r) => r.statusCode === 200));
    const id = results[0].json().id;
    assert.equal(results[1].json().id, id);
    assert.equal((await post({ ...d, name: "Changed" })).statusCode, 409);
    assert.equal(
      (await post({ ...d, itinerary: [{ ...d.itinerary[0], day: 3 }] }))
        .statusCode,
      409,
    );
    const versions = await Promise.all(
      [1, 2].map((n) =>
        app.inject({
          method: "PATCH",
          url: "/api/v1/admin/packages/" + id,
          headers: a.headers,
          payload: {
            content: { ...d, name: "Changed " + n },
            expectedVersion: 1,
            reason,
          },
        }),
      ),
    );
    assert.deepEqual(versions.map((r) => r.statusCode).sort(), [200, 409]);
    const prefix = randomUUID();
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO packages.definitions(id,code,content,created_at) VALUES($1,$2,$3,'2086-01-01')",
        [randomUUID(), prefix + "-" + i, { ...d, name: prefix + " Package" }],
      );
    const first = (
      await app.inject({
        url: "/api/v1/admin/packages?q=" + prefix + "&destination=Pune",
        headers: a.headers,
      })
    ).json();
    assert.equal(first.items.length, 25);
    const next = await app.inject({
      url:
        "/api/v1/admin/packages?q=" +
        prefix +
        "&destination=Pune&after=" +
        encodeURIComponent(first.nextCursor),
      headers: a.headers,
    });
    assert.equal(next.json().items.length, 2);
    assert.equal(
      (
        await app.inject({
          url:
            "/api/v1/admin/packages?q=" +
            prefix +
            "&destination=Delhi&after=" +
            encodeURIComponent(first.nextCursor),
          headers: a.headers,
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
test("Package/allotment writes roll back on audit failure", async () => {
  const a = await account(["packages.read", "packages.manage"]),
    code = "p-" + randomUUID(),
    service = new PackageAdministration(
      new PostgresPackages(new PostgresStaffAuthorization()),
      new PostgresPackageAllotments(),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
  await assert.rejects(
    service.create(a.id, randomUUID(), { code, content: definition(), reason }),
    /Audit unavailable/,
  );
  assert.equal(
    (
      await pool.query("SELECT 1 FROM packages.definitions WHERE code=$1", [
        code,
      ])
    ).rowCount,
    0,
  );
});
test("Package definition validation rejects inconsistent dates, component identities and incomplete publication", async () => {
  const app = await buildApp(),
    a = await account(["packages.read", "packages.manage", "packages.review"]),
    d = definition();
  const create = (content: Definition) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/packages",
      headers: { ...a.headers, "idempotency-key": randomUUID() },
      payload: { code: "p-" + randomUUID(), content, reason },
    });
  try {
    assert.equal(
      (await create({ ...d, components: [d.components[0], d.components[0]] }))
        .statusCode,
      422,
    );
    assert.equal(
      (
        await create({
          ...d,
          departures: [{ start: "2085-01-01", end: "2085-01-03" }],
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await create({
          ...d,
          itinerary: [{ ...d.itinerary[0], day: 3 }, d.itinerary[1]],
        })
      ).statusCode,
      422,
    );
    const id = (await create({ ...d, images: [] })).json().id;
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/admin/packages/" + id + "/actions",
          headers: a.headers,
          payload: { action: "submit", expectedVersion: 1, reason },
        })
      ).statusCode,
      422,
    );
    const complete = (await create(d)).json().id;
    const failed = new PackageAdministration(
      new PostgresPackages(new PostgresStaffAuthorization()),
      new PostgresPackageAllotments(),
      {
        record: async () => {
          throw Error("Audit unavailable");
        },
      },
    );
    await assert.rejects(
      failed.allotment(a.id, complete, {
        departure: "2085-01-01",
        expectedVersion: 1,
        allotmentVersion: 0,
        capacity: 4,
        components: [{ id: "hotel", capacity: 4 }],
        reason,
      }),
      /Audit unavailable/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM inventory.package_allotments WHERE package_id=$1",
          [complete],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM packages.history WHERE package_id=$1 AND action='allotment.planned'",
          [complete],
        )
      ).rowCount,
      0,
    );
  } finally {
    await app.close();
  }
});
