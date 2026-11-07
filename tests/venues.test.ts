import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { validatePlan, type Plan } from "../src/modules/venues/domain/plan.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
const plan: Plan = {
  orientation: "TEST SCREEN AT TOP",
  resources: [
    {
      id: "A1",
      kind: "seat",
      label: "1",
      row: "A",
      section: "Main",
      gate: "North",
      capacity: 1,
      x: 10,
      y: 20,
      accessible: true,
    },
    {
      id: "A2",
      kind: "seat",
      label: "2",
      row: "A",
      section: "Main",
      gate: "North",
      capacity: 1,
      x: 20,
      y: 20,
      accessible: false,
      companionOf: "A1",
    },
  ],
};
async function fixture() {
  const app = await buildApp(),
    owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'VENUE FIXTURE','cinema','approved')",
    [org, owner],
  );
  await pool.query("INSERT INTO providers.memberships VALUES($1,$2,'owner')", [
    org,
    owner,
  ]);
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'VENUE FIXTURE','movie','Test city','Isolated fixture','published')",
    [listing, org],
  );
  const headers = { cookie: `session=${token}` };
  const request = async (
    method: "GET" | "POST",
    url: string,
    payload?: any,
    key?: string,
  ) =>
    app.inject({
      method,
      url,
      headers: { ...headers, ...(key ? { "idempotency-key": key } : {}) },
      ...(payload ? { payload } : {}),
    });
  const v = await request("POST", `/api/v1/organizations/${org}/venues`, {
    name: "TEST VENUE",
    address: "ISOLATED FIXTURE ADDRESS",
    city: "Test city",
    timeZone: "Asia/Kolkata",
    amenities: "",
    accessibility: "Step-free test fixture",
  });
  assert.equal(v.statusCode, 200, v.body);
  const venue = v.json().id;
  const s = await request(
    "POST",
    `/api/v1/organizations/${org}/venues/${venue}/spaces`,
    {
      name: "TEST SCREEN",
      kind: "screen",
      physicalCapacity: 2,
      turnaroundMinutes: 15,
    },
  );
  assert.equal(s.statusCode, 200, s.body);
  const space = s.json().id;
  const p = await request(
    "POST",
    `/api/v1/organizations/${org}/spaces/${space}/plans`,
    { label: "TEST VERSION", expectedVersion: 1, configuration: plan },
  );
  assert.equal(p.statusCode, 200, p.body);
  const planId = p.json().id;
  const start = new Date(Date.now() + 86400000 * 15);
  start.setUTCHours(12, 0, 0, 0);
  const input = {
    organizationId: org,
    listingId: listing,
    planId,
    startsAt: start.toISOString(),
    endsAt: new Date(+start + 7200000).toISOString(),
    salesOpen: new Date(+start - 86400000 * 10).toISOString(),
    salesClose: new Date(+start - 60000).toISOString(),
    prices: { A1: 25000, A2: 25000 },
  };
  return {
    app,
    owner,
    org,
    listing,
    venue,
    space,
    planId,
    headers,
    request,
    input,
  };
}
test("Plan domain validates capacity, duplicate identities/geometry and companion references", () => {
  assert.equal(validatePlan(plan, 2), 2);
  assert.throws(() => validatePlan(plan, 1), {
    code: "PHYSICAL_CAPACITY_EXCEEDED",
  });
  assert.throws(
    () =>
      validatePlan(
        { ...plan, resources: [plan.resources[0], plan.resources[0]] },
        2,
      ),
    { code: "DUPLICATE_RESOURCE" },
  );
  assert.throws(
    () =>
      validatePlan(
        {
          ...plan,
          resources: [
            plan.resources[0],
            { ...plan.resources[1], companionOf: "missing" },
          ],
        },
        2,
      ),
    { code: "INVALID_COMPANION" },
  );
  assert.throws(
    () =>
      validatePlan(
        { ...plan, resources: [{ ...plan.resources[0], capacity: 2 }] },
        2,
      ),
    { code: "INVALID_CAPACITY" },
  );
});
test("Provider venue/plan APIs isolate tenants and enforce immutable versions with one concurrent winner", async () => {
  const f = await fixture();
  try {
    assert.equal(
      (await f.request("GET", `/api/v1/organizations/${randomUUID()}/venues`))
        .statusCode,
      403,
    );
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        f.request(
          "POST",
          `/api/v1/organizations/${f.org}/spaces/${f.space}/plans`,
          { label: "TEST v" + i, expectedVersion: 2, configuration: plan },
        ),
      ),
    );
    assert.equal(outcomes.filter((r) => r.statusCode === 200).length, 1);
    assert(
      outcomes
        .filter((r) => r.statusCode !== 200)
        .every((r) => r.json().code === "VERSION_CONFLICT"),
    );
    await assert.rejects(
      pool.query("UPDATE venues.plans SET label=$2 WHERE id=$1", [
        f.planId,
        "tampered",
      ]),
    );
    const view = await f.request(
      "GET",
      `/api/v1/organizations/${f.org}/venues`,
    );
    assert.equal(view.json().plans.length, 2);
  } finally {
    await f.app.close();
  }
});
test("Concurrent overlapping schedules from distinct actors produce exactly one occurrence", async () => {
  const f = await fixture();
  try {
    const responses = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const actor = randomUUID(),
          token = randomBytes(24).toString("hex");
        await pool.query(
          "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
          [actor, `${actor}@fixture.invalid`],
        );
        await pool.query(
          "INSERT INTO providers.memberships VALUES($1,$2,'editor')",
          [f.org, actor],
        );
        await pool.query(
          "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
          [hashToken(token), actor],
        );
        return f.app.inject({
          method: "POST",
          url: "/api/v1/occurrences",
          headers: {
            cookie: `session=${token}`,
            "idempotency-key": randomUUID(),
          },
          payload: f.input,
        });
      }),
    );
    assert.equal(responses.filter((r) => r.statusCode === 200).length, 1);
    for (const r of responses.filter((r) => r.statusCode !== 200))
      assert.equal(r.json().code, "SCHEDULE_CONFLICT", r.body);
    const id = responses.find((r) => r.statusCode === 200)!.json().id;
    const inventory = await f.request(
      "GET",
      `/api/v1/occurrences/${id}/inventory`,
    );
    assert.equal(inventory.json().resources.length, 2);
    assert.equal(inventory.json().occurrence.plan_id, f.planId);
    assert.equal(
      inventory.json().occurrence.venue_snapshot.configuration.resources[1]
        .companionOf,
      "A1",
    );
  } finally {
    await f.app.close();
  }
});
test("Scheduling retries return original result, enforce exact prices and honor turnaround", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(),
      first = await f.request("POST", "/api/v1/occurrences", f.input, key);
    assert.equal(first.statusCode, 200, first.body);
    const again = await f.request("POST", "/api/v1/occurrences", f.input, key);
    assert.equal(again.json().id, first.json().id);
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          { ...f.input, prices: { A1: 1, A2: 1 } },
          key,
        )
      ).json().code,
      "IDEMPOTENCY_CONFLICT",
    );
    const at = (minutes: number) =>
      new Date(Date.parse(f.input.endsAt) + minutes * 60000).toISOString();
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          { ...f.input, startsAt: at(14), endsAt: at(120) },
          randomUUID(),
        )
      ).json().code,
      "SCHEDULE_CONFLICT",
    );
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          {
            ...f.input,
            startsAt: at(15),
            endsAt: at(120),
            prices: { A1: 100 },
          },
          randomUUID(),
        )
      ).json().code,
      "PRICE_CONFIGURATION",
    );
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          { ...f.input, startsAt: at(15), endsAt: at(120) },
          randomUUID(),
        )
      ).statusCode,
      200,
    );
  } finally {
    await f.app.close();
  }
});
test("New plan cannot rewrite scheduled snapshots; foreign plans and unapproved providers are rejected", async () => {
  const f = await fixture(),
    other = await fixture();
  try {
    const booked = await f.request(
      "POST",
      "/api/v1/occurrences",
      f.input,
      randomUUID(),
    );
    assert.equal(booked.statusCode, 200, booked.body);
    await f.request(
      "POST",
      `/api/v1/organizations/${f.org}/spaces/${f.space}/plans`,
      {
        label: "TEST NEW",
        expectedVersion: 2,
        configuration: { ...plan, orientation: "DIFFERENT TEST ORIENTATION" },
      },
    );
    await assert.rejects(
      pool.query("UPDATE venues.spaces SET physical_capacity=1 WHERE id=$1", [
        f.space,
      ]),
    );
    await assert.rejects(
      pool.query(
        "UPDATE inventory.occurrences SET venue_snapshot='{}' WHERE id=$1",
        [booked.json().id],
      ),
    );
    const original = await f.request(
      "GET",
      `/api/v1/occurrences/${booked.json().id}/inventory`,
    );
    assert.equal(
      original.json().occurrence.venue_snapshot.configuration.orientation,
      plan.orientation,
    );
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          { ...f.input, planId: other.planId },
          randomUUID(),
        )
      ).statusCode,
      404,
    );
    await pool.query(
      "UPDATE providers.organizations SET state='suspended' WHERE id=$1",
      [f.org],
    );
    assert.equal(
      (
        await f.request("POST", "/api/v1/occurrences", f.input, randomUUID())
      ).json().code,
      "PROVIDER_NOT_APPROVED",
    );
  } finally {
    await f.app.close();
    await other.app.close();
  }
});
test("Scheduling rejects wrong venue-local offsets and obsolete arbitrary-resource payloads", async () => {
  const f = await fixture();
  try {
    const wrong = {
      ...f.input,
      startsAt: f.input.startsAt.replace("Z", "+00:00"),
      endsAt: f.input.endsAt.replace("Z", "+00:00"),
    };
    assert.equal(
      (
        await f.request("POST", "/api/v1/occurrences", wrong, randomUUID())
      ).json().code,
      "TIME_ZONE_OFFSET_MISMATCH",
    );
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences",
          { ...f.input, resources: [], venueName: "Bypass" },
          randomUUID(),
        )
      ).statusCode,
      422,
    );
  } finally {
    await f.app.close();
  }
});

test("Draft edits preserve revisions, reject stale versions and stay private until moderation", async () => {
  const f = await fixture();
  try {
    const input = {
      title: "PRIVATE DRAFT FIXTURE",
      kind: "event",
      city: "Test city",
      description: "Isolated draft content fixture",
      metadata: { language: "Test language" },
    };
    const created = await f.request(
      "POST",
      `/api/v1/organizations/${f.org}/listings`,
      input,
    );
    assert.equal(created.statusCode, 200, created.body);
    const listing = created.json();
    assert.equal(
      (await f.request("GET", `/api/v1/catalog/${listing.id}`)).statusCode,
      404,
    );
    const updates = await Promise.all(
      Array.from({ length: 6 }, () =>
        f.app.inject({
          method: "PUT",
          url: `/api/v1/listings/${listing.id}`,
          headers: f.headers,
          payload: {
            ...input,
            title: "EDITED FIXTURE",
            version: listing.version,
          },
        }),
      ),
    );
    assert.equal(updates.filter((r) => r.statusCode === 200).length, 1);
    assert(
      updates
        .filter((r) => r.statusCode !== 200)
        .every((r) => r.json().code === "CONFLICT"),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM catalog.revisions WHERE listing_id=$1",
          [listing.id],
        )
      ).rows[0].n,
      1,
    );
    const saved = updates.find((r) => r.statusCode === 200)!.json();
    const submitted = await f.request(
      "POST",
      `/api/v1/listings/${listing.id}/submit`,
      { version: saved.version },
    );
    assert.equal(submitted.statusCode, 200, submitted.body);
    assert.equal(
      (
        await f.app.inject({
          method: "PUT",
          url: `/api/v1/listings/${listing.id}`,
          headers: f.headers,
          payload: { ...input, version: submitted.json().version },
        })
      ).json().code,
      "CONFLICT",
    );
    assert.equal(
      (await f.request("GET", `/api/v1/catalog/${listing.id}`)).statusCode,
      404,
    );
  } finally {
    await f.app.close();
  }
});
