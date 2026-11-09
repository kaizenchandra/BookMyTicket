import {
  favoritePage,
  favoriteState,
} from "../src/modules/profiles/adapters/favorites-schema.ts";
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
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
async function fixture(count = 1) {
  const owner = randomUUID(),
    other = randomUUID(),
    org = randomUUID(),
    token = randomBytes(24).toString("hex"),
    otherToken = randomBytes(24).toString("hex"),
    ids = [];
  for (const [id, t] of [
    [owner, token],
    [other, otherToken],
  ]) {
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, `${id}@fixture.invalid`],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hashToken(t), id],
    );
  }
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'FAVORITES FIXTURE','event','approved')",
    [org, owner],
  );
  for (let i = 0; i < count; i++) {
    const id = randomUUID();
    ids.push(id);
    await pool.query(
      "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'FAVORITE FIXTURE','event','Test city','Isolated fixture','published')",
      [id, org],
    );
  }
  return {
    owner,
    other,
    ids,
    headers: { cookie: `session=${token}` },
    otherHeaders: { cookie: `session=${otherToken}` },
  };
}
test("Favorites save/remove are idempotent under concurrency and account scoped", async () => {
  const f = await fixture(),
    app = await buildApp(),
    url = `/api/v1/favorites/${f.ids[0]}`;
  try {
    assert.equal(
      (await app.inject({ method: "PUT", url, payload: {} })).statusCode,
      401,
    );
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        app.inject({ method: "PUT", url, headers: f.headers, payload: {} }),
      ),
    );
    assert(results.every((r) => r.statusCode === 200));
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/favorites",
          headers: f.headers,
        })
      ).json().items.length,
      1,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/favorites",
          headers: f.otherHeaders,
        })
      ).json().items.length,
      0,
    );
    await app.inject({ method: "DELETE", url, headers: f.otherHeaders });
    assert.equal(
      (await app.inject({ method: "GET", url, headers: f.headers })).json()
        .saved,
      true,
    );
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await app.inject({ method: "DELETE", url, headers: f.headers }))
          .statusCode,
        200,
      );
    assert.equal(
      (await app.inject({ method: "GET", url, headers: f.headers })).json()
        .saved,
      false,
    );
  } finally {
    await app.close();
  }
});
test("Unpublished favorites never expose private content and remain removable", async () => {
  const f = await fixture(),
    app = await buildApp(),
    url = `/api/v1/favorites/${f.ids[0]}`;
  try {
    await app.inject({ method: "PUT", url, headers: f.headers, payload: {} });
    await pool.query(
      "UPDATE catalog.listings SET state='draft',title='PRIVATE REVISION' WHERE id=$1",
      [f.ids[0]],
    );
    const page = await app.inject({
      method: "GET",
      url: "/api/v1/favorites",
      headers: f.headers,
    });
    favoritePage.parse(page.json());
    assert.equal(page.json().items[0].listing, null);
    assert(!page.body.includes("PRIVATE REVISION"));
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url,
          headers: f.otherHeaders,
          payload: {},
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (await app.inject({ method: "DELETE", url, headers: f.headers }))
        .statusCode,
      200,
    );
  } finally {
    await app.close();
  }
});
test("Favorites use bounded stable cursor pagination and reject invalid inputs", async () => {
  const f = await fixture(27),
    app = await buildApp();
  try {
    for (const id of f.ids)
      await app.inject({
        method: "PUT",
        url: `/api/v1/favorites/${id}`,
        headers: f.headers,
        payload: {},
      });
    const first = (
      await app.inject({
        method: "GET",
        url: "/api/v1/favorites",
        headers: f.headers,
      })
    ).json();
    favoritePage.parse(first);
    assert.equal(first.items.length, 24);
    assert(first.nextCursor);
    const second = (
      await app.inject({
        method: "GET",
        url: "/api/v1/favorites?after=" + first.nextCursor,
        headers: f.headers,
      })
    ).json();
    favoritePage.parse(second);
    assert.equal(second.items.length, 3);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.listingId)).size,
      27,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/favorites?after=invalid",
          headers: f.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "PUT",
          url: `/api/v1/favorites/${f.ids[0]}`,
          headers: f.headers,
          payload: { ownerId: f.other },
        })
      ).statusCode,
      422,
    );
  } finally {
    await app.close();
  }
});

test("Favorite contracts preserve authentication, empty state and strict query validation", async () => {
  const f = await fixture(),
    app = await buildApp();
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/favorites" })).statusCode,
      401,
    );
    const empty = await app.inject({
      url: "/api/v1/favorites",
      headers: f.headers,
    });
    assert.deepEqual(favoritePage.parse(empty.json()), {
      items: [],
      nextCursor: null,
    });
    const url = `/api/v1/favorites/${f.ids[0]}`;
    for (const [method, saved] of [
      ["GET", false],
      ["PUT", true],
      ["GET", true],
      ["DELETE", false],
    ] as const) {
      const response = await app.inject({
        method,
        url,
        headers: f.headers,
        ...(method === "PUT" ? { payload: {} } : {}),
      });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(favoriteState.parse(response.json()), { saved });
    }
    for (const query of [
      "after=",
      "after=invalid",
      "ownerId=" + f.other,
      "limit=1000",
      "after=" + f.ids[0] + "&after=" + f.ids[0],
    ])
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/favorites?" + query,
            headers: f.headers,
          })
        ).statusCode,
        422,
      );
  } finally {
    await app.close();
  }
});
