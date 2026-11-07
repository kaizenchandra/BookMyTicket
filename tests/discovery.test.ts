import { catalogSearchResponse } from "../src/modules/catalog/adapters/schemas.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function fixture() {
  const owner = randomUUID(),
    org = randomUUID(),
    city = `Fixture ${randomUUID()}`;
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'DISCOVERY FIXTURE','cinema','approved')",
    [org, owner],
  );
  const ids = [];
  for (let n = 0; n < 30; n++) {
    const id = randomUUID();
    ids.push(id);
    await pool.query(
      "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state,metadata,created_at) VALUES($1,$2,$3,'movie',$4,'Isolated discovery fixture','published',$5,'2026-01-01T00:00:00.123456Z')",
      [
        id,
        org,
        `Fixture title ${String(Math.floor(n / 2)).padStart(2, "0")}`,
        city,
        {
          language: n % 2 ? "Hindi" : "Tamil",
          genre: n % 2 ? "Drama" : "Comedy",
          format: "2D",
        },
      ],
    );
  }
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state,metadata) VALUES($1,$2,'SECRET DRAFT TITLE','movie',$3,'Isolated private fixture','draft','{\"genre\":\"SECRET GENRE\"}')",
    [randomUUID(), org, city],
  );
  return { org, city, ids };
}
test("title and newest keyset pagination preserve ties and database timestamp precision", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    for (const sort of ["title", "newest"]) {
      const base = new URLSearchParams({ city: f.city, kind: "movie", sort });
      const first = await app.inject({
        method: "GET",
        url: `/api/v1/catalog?${base}`,
      });
      assert.equal(first.statusCode, 200, first.body);
      const page = catalogSearchResponse.parse(first.json());
      assert.equal(page.total, 30);
      assert.equal(page.items.length, 24);
      assert.ok(page.nextCursor);
      base.set("after", page.nextCursor);
      const next = await app.inject({
        method: "GET",
        url: `/api/v1/catalog?${base}`,
      });
      assert.equal(next.statusCode, 200, next.body);
      assert.equal(next.json().items.length, 6);
      assert.equal(next.json().nextCursor, null);
      const ids = [...page.items, ...next.json().items].map((r: any) => r.id);
      assert.equal(new Set(ids).size, 30);
      assert.deepEqual([...ids].sort(), [...f.ids].sort());
      base.set("language", "Hindi");
      assert.equal(
        (await app.inject({ method: "GET", url: `/api/v1/catalog?${base}` }))
          .statusCode,
        422,
      );
    }
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/catalog?after=not-a-cursor",
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
test("facets reflect published data and search treats SQL wildcard characters literally", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    const base = new URLSearchParams({
      city: f.city,
      kind: "movie",
      language: "hindi",
    });
    let result = await app.inject({
      method: "GET",
      url: `/api/v1/catalog?${base}`,
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().total, 15);
    assert.deepEqual(result.json().facets.genre, ["Drama"]);
    assert.deepEqual(result.json().facets.language, ["Hindi", "Tamil"]);
    assert.ok(!result.body.includes("SECRET"));
    const id = randomUUID();
    await pool.query(
      "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state,metadata) VALUES($1,$2,'100%_Real Fixture','event',$3,'Literal wildcard fixture','published','{}')",
      [id, f.org, f.city],
    );
    for (const q of ["%_", "100%_Real"]) {
      result = await app.inject({
        method: "GET",
        url: `/api/v1/catalog?${new URLSearchParams({ city: f.city, q })}`,
      });
      assert.equal(result.statusCode, 200, result.body);
      assert.deepEqual(
        result.json().items.map((r: any) => r.id),
        [id],
      );
    }
    result = await app.inject({
      method: "GET",
      url: `/api/v1/catalog?${new URLSearchParams({ city: f.city, language: "Hindi", genre: "Comedy" })}`,
    });
    assert.equal(result.json().total, 0);
  } finally {
    await app.close();
  }
});
test("grouped suggestions are bounded and never expose drafts or another city", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    for (const kind of ["event", "sports"])
      await pool.query(
        "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state,metadata) VALUES($1,$2,'Fixture searchable title',$3,$4,'Suggestions fixture','published','{}')",
        [randomUUID(), f.org, kind, f.city],
      );
    const result = await app.inject({
      method: "GET",
      url: `/api/v1/catalog/suggestions?${new URLSearchParams({ city: f.city, q: "Fixture" })}`,
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.deepEqual(
      result.json().groups.map((g: any) => g.kind),
      ["movie", "event", "sports"],
    );
    assert.ok(
      result
        .json()
        .groups.every(
          (g: any) =>
            g.items.length <= 4 && g.items.every((i: any) => i.city === f.city),
        ),
    );
    assert.ok(!result.body.includes("SECRET"));
    const secret = await app.inject({
      method: "GET",
      url: `/api/v1/catalog/suggestions?${new URLSearchParams({ city: f.city, q: "SECRET" })}`,
    });
    assert.deepEqual(secret.json().groups, []);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/catalog/suggestions?q=x",
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});

test("Upcoming discovery filters expired, unscheduled and cancelled projections with scoped pagination", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    for (const [index, id] of f.ids.entries()) {
      if (index === 29) continue;
      await pool.query(
        "INSERT INTO catalog.session_projection(occurrence_id,listing_id,starts_at,time_zone,venue_name,state) VALUES($1,$2,clock_timestamp()+make_interval(days=>$3),'Asia/Kolkata','Fixture venue',$4)",
        [
          randomUUID(),
          id,
          index === 28 ? -1 : 2,
          index === 27 ? "cancelled" : "open",
        ],
      );
    }
    const query = new URLSearchParams({
      city: f.city,
      upcoming: "true",
      sort: "title",
    });
    const first = (
      await app.inject({ url: "/api/v1/catalog?" + query })
    ).json();
    assert.equal(first.total, 27);
    assert.equal(first.items.length, 24);
    assert(
      first.items.every((x: any) => x.nextSession.timeZone === "Asia/Kolkata"),
    );
    query.set("after", first.nextCursor);
    const second = (
      await app.inject({ url: "/api/v1/catalog?" + query })
    ).json();
    assert.equal(second.items.length, 3);
    query.set("upcoming", "false");
    assert.equal(
      (await app.inject({ url: "/api/v1/catalog?" + query })).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});
