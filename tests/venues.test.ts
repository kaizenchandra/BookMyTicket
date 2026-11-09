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
      randomUUID(),
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
    assert.equal(updates.filter((r) => r.statusCode === 200).length, 6);
    for (const update of updates)
      assert.deepEqual(update.json(), updates[0].json());
    const changedRetry = await f.app.inject({
      method: "PUT",
      url: `/api/v1/listings/${listing.id}`,
      headers: f.headers,
      payload: {
        ...input,
        title: "Different stale edit",
        version: listing.version,
      },
    });
    assert.equal(changedRetry.statusCode, 409);
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

const localOffset = (value: string) =>
  new Date(Date.parse(value) + 330 * 60000)
    .toISOString()
    .replace("Z", "+05:30");
test("Recurring series preview, excluded dates and concurrent retry create each occurrence exactly once", async () => {
  const f = await fixture();
  const schedule = {
    ...f.input,
    startsAt: localOffset(f.input.startsAt),
    endsAt: localOffset(f.input.endsAt),
    salesClose: localOffset(f.input.salesClose),
  };
  const second = new Date(Date.parse(f.input.startsAt) + 7 * 86400000);
  const excluded = localOffset(second.toISOString()).slice(0, 10);
  const input = {
    schedule,
    repeat: {
      frequency: "weekly",
      interval: 1,
      count: 4,
      excludeDates: [excluded],
    },
  };
  try {
    const preview = await f.request(
      "POST",
      "/api/v1/occurrences/series/preview",
      input,
    );
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().items.length, 3);
    assert.equal(preview.json().conflictsChecked, false);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM inventory.occurrences WHERE listing_id=$1",
          [f.listing],
        )
      ).rowCount,
      0,
    );
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        f.request("POST", "/api/v1/occurrences/series", input, key),
      ),
    );
    assert(
      results.every((r) => r.statusCode === 200),
      results.map((r) => r.body).join("\n"),
    );
    assert(
      results.every(
        (r) =>
          JSON.stringify(r.json().ids) ===
          JSON.stringify(results[0].json().ids),
      ),
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM inventory.occurrences WHERE listing_id=$1",
          [f.listing],
        )
      ).rowCount,
      3,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.session_projection WHERE listing_id=$1",
          [f.listing],
        )
      ).rowCount,
      3,
    );
    assert.equal(
      (
        await f.request(
          "POST",
          "/api/v1/occurrences/series",
          { ...input, repeat: { ...input.repeat, count: 5 } },
          key,
        )
      ).statusCode,
      409,
    );
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    assert.equal(
      (await f.request("POST", "/api/v1/occurrences/series", input, key))
        .statusCode,
      403,
    );
  } finally {
    await f.app.close();
  }
});
test("A conflict in a later recurring session rolls back earlier sessions, resources, commands and projection", async () => {
  const f = await fixture();
  try {
    const shift = (value: string) =>
      new Date(Date.parse(value) + 7 * 86400000).toISOString();
    const conflict = {
      ...f.input,
      startsAt: shift(f.input.startsAt),
      endsAt: shift(f.input.endsAt),
      salesClose: shift(f.input.salesClose),
    };
    assert.equal(
      (await f.request("POST", "/api/v1/occurrences", conflict, randomUUID()))
        .statusCode,
      200,
    );
    const input = {
      schedule: {
        ...f.input,
        startsAt: localOffset(f.input.startsAt),
        endsAt: localOffset(f.input.endsAt),
        salesClose: localOffset(f.input.salesClose),
      },
      repeat: { frequency: "weekly", interval: 1, count: 3, excludeDates: [] },
    };
    const result = await f.request(
      "POST",
      "/api/v1/occurrences/series",
      input,
      randomUUID(),
    );
    assert.equal(result.statusCode, 409, result.body);
    assert.equal(result.json().code, "SCHEDULE_CONFLICT");
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM inventory.occurrences WHERE listing_id=$1",
          [f.listing],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM catalog.session_projection WHERE listing_id=$1",
          [f.listing],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM inventory.schedule_series WHERE actor_id=$1",
          [f.owner],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM inventory.schedule_commands WHERE actor_id=$1",
          [f.owner],
        )
      ).rowCount,
      1,
    );
  } finally {
    await f.app.close();
  }
});
test("Recurrence bounds, explicit offsets and calendar exclusions are validated", async () => {
  const { expandRecurrence } =
    await import("../src/modules/inventory/domain/recurrence.ts");
  const schedule = {
    startsAt: "2027-01-30T18:00:00+05:30",
    endsAt: "2027-01-30T20:00:00+05:30",
    salesOpen: "2027-01-01T00:00:00Z",
    salesClose: "2027-01-30T17:00:00+05:30",
  };
  const repeat = {
    frequency: "daily" as const,
    interval: 1,
    count: 4,
    excludeDates: ["2027-01-31"],
  };
  const expanded = expandRecurrence(schedule, repeat);
  assert.deepEqual(
    expanded.map((s) => s.startsAt.slice(0, 10)),
    ["2027-01-30", "2027-02-01", "2027-02-02"],
  );
  assert(expanded.every((s) => s.salesOpen === schedule.salesOpen));
  assert.throws(() => expandRecurrence(schedule, { ...repeat, count: 25 }), {
    code: "INVALID_RECURRENCE",
  });
  assert.throws(
    () =>
      expandRecurrence(schedule, { ...repeat, excludeDates: ["2027-03-01"] }),
    { code: "INVALID_RECURRENCE" },
  );
  assert.throws(
    () =>
      expandRecurrence(
        { ...schedule, startsAt: "2027-01-30T12:30:00Z" },
        repeat,
      ),
    { code: "RECURRENCE_OFFSET_REQUIRED" },
  );
});

test("Public venues require published discovery and approved providers, with bounded scoped pages", async () => {
  const f = await fixture();
  const get = (suffix = "") =>
    f.app.inject({ method: "GET", url: `/api/v1/venues/${f.venue}${suffix}` });
  try {
    assert.equal((await get()).statusCode, 404);
    const ids: string[] = [];
    for (let day = 0; day < 23; day++) {
      const shift = (value: string) =>
        new Date(Date.parse(value) + day * 86400000).toISOString();
      const scheduled = await f.request(
        "POST",
        "/api/v1/occurrences",
        {
          ...f.input,
          startsAt: shift(f.input.startsAt),
          endsAt: shift(f.input.endsAt),
          salesClose: shift(f.input.salesClose),
        },
        randomUUID(),
      );
      assert.equal(scheduled.statusCode, 200, scheduled.body);
    }
    const first = await get();
    assert.equal(first.statusCode, 200, first.body);
    const page = first.json();
    assert.equal(page.venue.name, "TEST VENUE");
    assert.equal(page.venue.address, "ISOLATED FIXTURE ADDRESS");
    assert.equal(page.venue.accessibility, "Step-free test fixture");
    assert.equal(page.venue.organizationId, undefined);
    assert.equal(page.items.length, 20);
    assert(page.nextCursor);
    ids.push(...page.items.map((item: any) => item.id));
    const next = await get(`?after=${encodeURIComponent(page.nextCursor)}`);
    assert.equal(next.statusCode, 200, next.body);
    assert.equal(next.json().items.length, 3);
    assert.equal(next.json().nextCursor, null);
    ids.push(...next.json().items.map((item: any) => item.id));
    assert.equal(new Set(ids).size, 23);
    assert.equal((await get("?after=invalid")).statusCode, 422);
    const cursor = JSON.parse(
      Buffer.from(page.nextCursor, "base64url").toString(),
    );
    cursor.scope = "0".repeat(64);
    assert.equal(
      (
        await get(
          `?after=${Buffer.from(JSON.stringify(cursor)).toString("base64url")}`,
        )
      ).statusCode,
      422,
    );
    await pool.query(
      "UPDATE providers.organizations SET state='suspended' WHERE id=$1",
      [f.org],
    );
    assert.equal((await get()).statusCode, 404);
    await pool.query(
      "UPDATE providers.organizations SET state='approved' WHERE id=$1",
      [f.org],
    );
    await pool.query("UPDATE catalog.listings SET state='draft' WHERE id=$1", [
      f.listing,
    ]);
    assert.equal((await get()).statusCode, 404);
    await pool.query(
      "UPDATE catalog.listings SET state='published' WHERE id=$1",
      [f.listing],
    );
    await pool.query(
      "UPDATE catalog.session_projection SET starts_at=now()-interval '1 day' WHERE listing_id=$1",
      [f.listing],
    );
    const empty = await get();
    assert.equal(empty.statusCode, 200, empty.body);
    assert.deepEqual(empty.json().items, []);
    assert.equal(empty.json().nextCursor, null);
  } finally {
    await f.app.close();
  }
});

test("Venue guidance is tenant protected, versioned, audited and public only through discovery", async () => {
  const f = await fixture();
  const url = `/api/v1/organizations/${f.org}/venues/${f.venue}/guidance`;
  const input = {
    expectedVersion: 1,
    amenities: "Water",
    accessibility: "Step-free entrance",
    transportGuidance: "Metro exit 2",
    parkingGuidance: "No on-site parking",
    entryPolicies: "Bag check at entry",
  };
  try {
    assert.equal(
      (await f.app.inject({ method: "POST", url, payload: input })).statusCode,
      401,
    );
    assert.equal(
      (
        await f.request("POST", url, {
          ...input,
          transportGuidance: "x".repeat(2001),
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (await f.request("POST", url, { ...input, unexpected: true })).statusCode,
      422,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.org, randomUUID()), input))
        .statusCode,
      403,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.venue, randomUUID()), input))
        .statusCode,
      404,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    assert.equal((await f.request("POST", url, input)).statusCode, 403);
    await pool.query(
      "UPDATE providers.memberships SET role='owner' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    const results = await Promise.all([
      f.request("POST", url, input),
      f.request("POST", url, { ...input, transportGuidance: "Bus stop 3" }),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const stored = (
      await pool.query("SELECT * FROM venues.venues WHERE id=$1", [f.venue])
    ).rows[0];
    assert.equal(stored.guidance_version, 2);
    const audits = (
      await pool.query(
        "SELECT details FROM reporting.audit WHERE target=$1 AND action='venue.guidance_updated'",
        [f.venue],
      )
    ).rows;
    assert.deepEqual(audits, [
      { details: { organizationId: f.org, version: 2 } },
    ]);
    assert.equal(
      (await f.app.inject({ method: "GET", url: `/api/v1/venues/${f.venue}` }))
        .statusCode,
      404,
    );
    const scheduled = await f.request(
      "POST",
      "/api/v1/occurrences",
      f.input,
      randomUUID(),
    );
    assert.equal(scheduled.statusCode, 200, scheduled.body);
    const read = await f.app.inject({
      method: "GET",
      url: `/api/v1/venues/${f.venue}`,
    });
    assert.equal(read.statusCode, 200, read.body);
    assert.equal(
      read.json().venue.transportGuidance,
      stored.transport_guidance,
    );
    assert.equal(read.json().venue.parkingGuidance, input.parkingGuidance);
    assert.equal(read.json().venue.entryPolicies, input.entryPolicies);
    const { PostgresVenues } =
      await import("../src/modules/venues/adapters/postgres.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const store = new PostgresVenues(new PostgresProviders(), {
      record: async () => {
        throw new Error("fixture audit failure");
      },
    });
    await assert.rejects(
      store.guidance(f.owner, f.org, f.venue, { ...input, expectedVersion: 2 }),
      /fixture audit failure/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT guidance_version FROM venues.venues WHERE id=$1",
          [f.venue],
        )
      ).rows[0].guidance_version,
      2,
    );
    const cleared = await f.request("POST", url, {
      ...input,
      expectedVersion: 2,
      transportGuidance: "",
      parkingGuidance: "",
      entryPolicies: "",
    });
    assert.equal(cleared.statusCode, 200, cleared.body);
    assert.equal(
      (
        await f.app.inject({ method: "GET", url: `/api/v1/venues/${f.venue}` })
      ).json().venue.entryPolicies,
      "",
    );
  } finally {
    await f.app.close();
  }
});

test("Venue contacts require explicit publication permission and support withdrawal without leaking private values", async () => {
  const f = await fixture();
  const url = `/api/v1/organizations/${f.org}/venues/${f.venue}/contact`;
  const input = {
    expectedVersion: 1,
    phone: "+919876543210",
    email: "venue@fixture.invalid",
    public: false,
  };
  const read = () =>
    f.app.inject({ method: "GET", url: `/api/v1/venues/${f.venue}` });
  try {
    assert.equal(
      (await f.app.inject({ method: "POST", url, payload: input })).statusCode,
      401,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.org, randomUUID()), input))
        .statusCode,
      403,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.venue, randomUUID()), input))
        .statusCode,
      404,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    assert.equal((await f.request("POST", url, input)).statusCode, 403);
    await pool.query(
      "UPDATE providers.memberships SET role='owner' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    for (const changes of [
      { phone: "javascript:alert(1)" },
      { email: "bad\r\nBcc: other@example.com" },
      { public: true, phone: "", email: "" },
      { extra: true },
    ])
      assert.equal(
        (await f.request("POST", url, { ...input, ...changes })).statusCode,
        422,
      );
    assert.equal((await f.request("POST", url, input)).statusCode, 200);
    assert.equal(
      (await f.request("POST", "/api/v1/occurrences", f.input, randomUUID()))
        .statusCode,
      200,
    );
    let response = await read();
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().venue.contact, null);
    assert(!response.body.includes(input.phone));
    assert(!response.body.includes(input.email));
    const races = await Promise.all([
      f.request("POST", url, { ...input, expectedVersion: 2, public: true }),
      f.request("POST", url, { ...input, expectedVersion: 2, public: true }),
    ]);
    assert.deepEqual(races.map((r) => r.statusCode).sort(), [200, 409]);
    assert.deepEqual((await read()).json().venue.contact, {
      phone: input.phone,
      email: input.email,
    });
    const audits = (
      await pool.query(
        "SELECT details FROM reporting.audit WHERE target=$1 AND action='venue.contact_updated' ORDER BY (details->>'version')::int",
        [f.venue],
      )
    ).rows;
    assert.deepEqual(audits, [
      { details: { organizationId: f.org, version: 2, public: false } },
      { details: { organizationId: f.org, version: 3, public: true } },
    ]);
    const { PostgresVenues } =
      await import("../src/modules/venues/adapters/postgres.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const store = new PostgresVenues(new PostgresProviders(), {
      record: async () => {
        throw new Error("contact audit fixture failure");
      },
    });
    await assert.rejects(
      store.contact(f.owner, f.org, f.venue, { ...input, expectedVersion: 3 }),
      /contact audit fixture failure/,
    );
    assert.deepEqual((await read()).json().venue.contact, {
      phone: input.phone,
      email: input.email,
    });
    assert.equal(
      (await f.request("POST", url, { ...input, expectedVersion: 3 }))
        .statusCode,
      200,
    );
    response = await read();
    assert.equal(response.json().venue.contact, null);
    assert(!response.body.includes(input.phone));
    assert(!response.body.includes(input.email));
    const row = (
      await pool.query(
        "SELECT contact_phone,contact_email,contact_version FROM venues.venues WHERE id=$1",
        [f.venue],
      )
    ).rows[0];
    assert.equal(row.contact_phone, input.phone);
    assert.equal(row.contact_version, 4);
    assert.equal(
      (
        await f.request("POST", url, {
          ...input,
          expectedVersion: 4,
          phone: "",
          email: "",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT contact_email FROM venues.venues WHERE id=$1",
          [f.venue],
        )
      ).rows[0].contact_email,
      "",
    );
  } finally {
    await f.app.close();
  }
});

test("Venue media validates references and preserves ordered metadata with tenant, publication and version controls", async () => {
  const f = await fixture();
  const url = `/api/v1/organizations/${f.org}/venues/${f.venue}/media`;
  const photo = {
    url: "https://images.fixture.invalid/front.jpg",
    kind: "photo",
    alt: "Front entrance with ramp",
    caption: "Main entrance",
    attribution: "Fixture photographer",
  };
  const map = {
    ...photo,
    url: "https://images.fixture.invalid/map.png",
    kind: "map",
    alt: "North gate and access ramp",
    caption: "Access map",
  };
  const input = { expectedVersion: 1, items: [photo, map] };
  const read = () =>
    f.app.inject({ method: "GET", url: `/api/v1/venues/${f.venue}` });
  try {
    assert.equal(
      (await f.app.inject({ method: "POST", url, payload: input })).statusCode,
      401,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.org, randomUUID()), input))
        .statusCode,
      403,
    );
    assert.equal(
      (await f.request("POST", url.replace(f.venue, randomUUID()), input))
        .statusCode,
      404,
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    assert.equal((await f.request("POST", url, input)).statusCode, 403);
    await pool.query(
      "UPDATE providers.memberships SET role='owner' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    for (const invalid of [
      "javascript:alert(1)",
      "data:image/png;base64,a",
      "http://images.fixture.invalid/a.jpg",
      "https://user:secret@images.fixture.invalid/a.jpg",
      "https://images.fixture.invalid/a.jpg#fragment",
      "https://images.fixture.invalid/a b.jpg",
    ]) {
      const response = await f.request("POST", url, {
        ...input,
        items: [{ ...photo, url: invalid }],
      });
      assert.equal(response.statusCode, 422, response.body);
    }
    for (const items of [
      [{ ...photo, alt: " " }],
      [{ ...photo, extra: true }],
      [photo, photo],
      Array.from({ length: 9 }, (_, i) => ({
        ...photo,
        url: `https://images.fixture.invalid/${i}.jpg`,
      })),
    ])
      assert.equal(
        (await f.request("POST", url, { ...input, items })).statusCode,
        422,
      );
    const race = await Promise.all([
      f.request("POST", url, input),
      f.request("POST", url, input),
    ]);
    assert.deepEqual(race.map((r) => r.statusCode).sort(), [200, 409]);
    assert.equal((await read()).statusCode, 404);
    assert.equal(
      (await f.request("POST", "/api/v1/occurrences", f.input, randomUUID()))
        .statusCode,
      200,
    );
    let response = await read();
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().venue.media, [photo, map]);
    const audits = (
      await pool.query(
        "SELECT details FROM reporting.audit WHERE target=$1 AND action='venue.media_updated'",
        [f.venue],
      )
    ).rows;
    assert.deepEqual(audits, [
      { details: { organizationId: f.org, version: 2, count: 2 } },
    ]);
    const { PostgresVenues } =
      await import("../src/modules/venues/adapters/postgres.ts");
    const { PostgresProviders } =
      await import("../src/modules/providers/adapters/postgres.ts");
    const store = new PostgresVenues(new PostgresProviders(), {
      record: async () => {
        throw new Error("media audit fixture failure");
      },
    });
    await assert.rejects(
      store.media(f.owner, f.org, f.venue, { expectedVersion: 2, items: [] }),
      /media audit fixture failure/,
    );
    assert.deepEqual((await read()).json().venue.media, [photo, map]);
    assert.equal(
      (
        await f.request("POST", url, {
          expectedVersion: 2,
          items: [map, photo],
        })
      ).statusCode,
      200,
    );
    assert.deepEqual((await read()).json().venue.media, [map, photo]);
    await pool.query("UPDATE catalog.listings SET state='draft' WHERE id=$1", [
      f.listing,
    ]);
    assert.equal((await read()).statusCode, 404);
    await pool.query(
      "UPDATE catalog.listings SET state='published' WHERE id=$1",
      [f.listing],
    );
    assert.equal(
      (await f.request("POST", url, { expectedVersion: 3, items: [] }))
        .statusCode,
      200,
    );
    assert.deepEqual((await read()).json().venue.media, []);
  } finally {
    await f.app.close();
  }
});

test("Venue favorites are retry safe, owner scoped, paginated and redact withdrawn venues", async () => {
  const f = await fixture(),
    other = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    other,
    `${other}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), other],
  );
  const url = `/api/v1/venue-favorites/${f.venue}`;
  const request = (
    method: "GET" | "PUT" | "DELETE",
    path = url,
    headers: Record<string, string> = f.headers,
    payload?: any,
  ) =>
    f.app.inject({
      method,
      url: path,
      headers,
      ...(payload ? { payload } : {}),
    });
  try {
    for (const method of ["GET", "PUT", "DELETE"] as const)
      assert.equal(
        (await request(method, url, {}, method === "PUT" ? {} : undefined))
          .statusCode,
        401,
      );
    assert.equal((await request("PUT", url, f.headers, {})).statusCode, 404);
    assert.equal(
      (await f.request("POST", "/api/v1/occurrences", f.input, randomUUID()))
        .statusCode,
      200,
    );
    const saves = await Promise.all(
      Array.from({ length: 8 }, () => request("PUT", url, f.headers, {})),
    );
    assert(saves.every((r) => r.statusCode === 200 && r.json().saved === true));
    const before = (
      await pool.query(
        "SELECT created_at FROM profiles.venue_favorites WHERE account_id=$1 AND venue_id=$2",
        [f.owner, f.venue],
      )
    ).rows;
    assert.equal(before.length, 1);
    assert.equal((await request("GET")).json().saved, true);
    assert.equal(
      (await request("GET", url, { cookie: `session=${token}` })).json().saved,
      false,
    );
    assert.equal(
      (await request("PUT", url, f.headers, { accountId: other })).statusCode,
      422,
    );
    let page = await request("GET", "/api/v1/venue-favorites");
    assert.equal(page.statusCode, 200, page.body);
    assert.deepEqual(page.json().items[0].venue, {
      id: f.venue,
      name: "TEST VENUE",
      city: "Test city",
      address: "ISOLATED FIXTURE ADDRESS",
    });
    assert.deepEqual(
      (
        await request("GET", "/api/v1/venue-favorites", {
          cookie: `session=${token}`,
        })
      ).json().items,
      [],
    );
    await pool.query(
      "UPDATE providers.organizations SET state='suspended' WHERE id=$1",
      [f.org],
    );
    assert.equal((await request("PUT", url, f.headers, {})).json().saved, true);
    assert.equal(
      (await request("PUT", url, { cookie: `session=${token}` }, {}))
        .statusCode,
      404,
    );
    page = await request("GET", "/api/v1/venue-favorites");
    assert.equal(page.json().items[0].venue, null);
    assert(!page.body.includes("TEST VENUE"));
    assert.equal(
      (
        await pool.query(
          "SELECT created_at FROM profiles.venue_favorites WHERE account_id=$1 AND venue_id=$2",
          [f.owner, f.venue],
        )
      ).rows[0].created_at.toISOString(),
      before[0].created_at.toISOString(),
    );
    // Retained bookmarks whose referenced venues are no longer available still page and remove correctly.
    for (let i = 0; i < 25; i++)
      await pool.query(
        "INSERT INTO profiles.venue_favorites(account_id,venue_id) VALUES($1,$2)",
        [f.owner, randomUUID()],
      );
    page = await request("GET", "/api/v1/venue-favorites");
    assert.equal(page.json().items.length, 24);
    assert(page.json().nextCursor);
    const second = await request(
      "GET",
      `/api/v1/venue-favorites?after=${page.json().nextCursor}`,
    );
    assert.equal(second.json().items.length, 2);
    assert.equal(second.json().nextCursor, null);
    assert.equal(
      new Set(
        [...page.json().items, ...second.json().items].map(
          (x: any) => x.venueId,
        ),
      ).size,
      26,
    );
    assert.equal(
      (await request("GET", "/api/v1/venue-favorites?after=bad")).statusCode,
      422,
    );
    assert.equal(
      (await request("GET", "/api/v1/venue-favorites?owner=other")).statusCode,
      422,
    );
    const removes = await Promise.all(
      Array.from({ length: 5 }, () => request("DELETE")),
    );
    assert(
      removes.every((r) => r.statusCode === 200 && r.json().saved === false),
    );
    assert.equal((await request("GET")).json().saved, false);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [f.owner],
    );
    assert.equal(
      (await request("GET", "/api/v1/venue-favorites")).statusCode,
      401,
    );
  } finally {
    await f.app.close();
  }
});
