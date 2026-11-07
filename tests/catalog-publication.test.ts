import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { PostgresProviders } from "../src/modules/providers/adapters/postgres.ts";
import { PostgresProviderReview } from "../src/modules/providers/adapters/review.ts";
import { PostgresCatalogManagement } from "../src/modules/catalog/adapters/manage.ts";

if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());

test("real draft, provider approval, submission and publication become publicly discoverable", async () => {
  const app = await buildApp();
  try {
    const owner = randomUUID(),
      reviewer = randomUUID(),
      token = randomBytes(32).toString("hex");
    for (const id of [owner, reviewer])
      await pool.query(
        "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
        [id, `${id}@fixture.invalid`],
      );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hashToken(token), owner],
    );
    const headers = { cookie: `session=${token}` };
    const providers = new PostgresProviders();
    const organization = await providers.create(
      owner,
      "ISOLATED CATALOG FIXTURE",
      "cinema",
    );
    const title = `CATALOG FIXTURE ${randomUUID()}`;
    const draft = await app.inject({
      method: "POST",
      url: `/api/v1/organizations/${organization.id}/listings`,
      headers,
      payload: {
        title,
        kind: "movie",
        city: "Test Catalog City",
        description: "Isolated publication test fixture",
        metadata: { language: "Hindi" },
      },
    });
    assert.equal(draft.statusCode, 200, draft.body);
    const listing = draft.json();
    const search = (city = "Test Catalog City") =>
      app.inject({
        method: "GET",
        url: `/api/v1/catalog?${new URLSearchParams({ kind: "movie", q: title, city })}`,
      });
    assert.equal((await search()).json().items.length, 0);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/catalog/${listing.id}`,
        })
      ).statusCode,
      404,
    );
    const submit = () =>
      app.inject({
        method: "POST",
        url: `/api/v1/listings/${listing.id}/submit`,
        headers,
        payload: { version: listing.version },
      });
    assert.equal(
      (await submit()).statusCode,
      403,
      "unapproved organization cannot submit",
    );
    const submitted = await providers.submit(owner, organization.id, 1);
    await new PostgresProviderReview().review(
      organization.id,
      submitted.version,
      "approved",
      "Isolated test approval",
      reviewer,
    );
    const result = await submit();
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(
      (await search()).json().items.length,
      0,
      "submitted content stays private",
    );
    const denied = await app.inject({
      method: "POST",
      url: `/api/v1/admin/listings/${listing.id}/review`,
      headers,
      payload: {
        version: result.json().version,
        state: "published",
        reason: "Cannot self grant moderation",
      },
    });
    assert.equal(denied.statusCode, 403);
    // Exercise the real persistence transition; this is not an assertion of staff MFA UI acceptance.
    const manager = new PostgresCatalogManagement(providers);
    await manager.review(
      listing.id,
      result.json().version,
      "published",
      "Isolated publication approval",
    );
    assert.deepEqual(
      (await search("  test catalog CITY  "))
        .json()
        .items.map((item: { id: string }) => item.id),
      [listing.id],
    );
    assert.equal((await search("Another city")).json().items.length, 0);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/catalog/${listing.id}`,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/catalog/${listing.id}/occurrences`,
        })
      ).json().items.length,
      0,
      "publication never fabricates showtimes",
    );
    await assert.rejects(
      manager.review(
        listing.id,
        result.json().version,
        "published",
        "Stale review",
      ),
      { code: "CONFLICT" },
    );
  } finally {
    await app.close();
  }
});
