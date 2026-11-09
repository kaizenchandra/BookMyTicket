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
test("Communication consent is opt-in, owner scoped, versioned and withdrawal is durable", async () => {
  const app = await buildApp(),
    owner = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  const url = "/api/v1/profile/communications",
    headers = { cookie: `session=${token}` };
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    const initial = (await app.inject({ url, headers })).json();
    assert.equal(initial.marketingEmail, false);
    assert.equal(initial.version, 0);
    const payload = {
      language: "hi",
      marketingEmail: true,
      version: 0,
      consentVersion: 1,
    };
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        app.inject({ url, method: "PUT", headers, payload }),
      ),
    );
    assert(results.every((r) => r.statusCode === 200));
    assert(results.every((r) => r.json().version === 1));
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM profiles.marketing_consent_history WHERE account_id=$1",
          [owner],
        )
      ).rowCount,
      1,
    );
    assert.equal(
      (
        await app.inject({
          url,
          method: "PUT",
          headers,
          payload: { ...payload, language: "ta" },
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await app.inject({
          url,
          method: "PUT",
          headers,
          payload: { ...payload, version: 1, ownerId: randomUUID() },
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          url,
          method: "PUT",
          headers,
          payload: { ...payload, version: 1, consentVersion: 2 },
        })
      ).statusCode,
      422,
    );
    const withdrawn = await app.inject({
      url,
      method: "PUT",
      headers,
      payload: { ...payload, version: 1, marketingEmail: false },
    });
    assert.equal(withdrawn.statusCode, 200);
    assert.equal(withdrawn.json().transactionalMessagesRequired, true);
    const other = randomUUID(),
      otherToken = randomBytes(24).toString("hex");
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [other, `${other}@fixture.invalid`],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hashToken(otherToken), other],
    );
    const otherResult = (
      await app.inject({ url, headers: { cookie: `session=${otherToken}` } })
    ).json();
    assert.equal(otherResult.version, 0);
    assert.equal(otherResult.language, "en");
    assert.equal(otherResult.marketingEmail, false);
    const history = (
      await pool.query(
        "SELECT granted,policy_version FROM profiles.marketing_consent_history WHERE account_id=$1 ORDER BY preference_version",
        [owner],
      )
    ).rows;
    assert.deepEqual(history, [
      { granted: true, policy_version: 1 },
      { granted: false, policy_version: 1 },
    ]);
    assert.equal(
      (await app.inject({ url, headers })).json().marketingEmail,
      false,
    );
  } finally {
    await app.close();
  }
});

test("Customer consent history paginates real changes and excludes other accounts", async () => {
  const app = await buildApp();
  async function account() {
    const id = randomUUID(),
      token = randomBytes(24).toString("hex");
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, `${id}@fixture.invalid`],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
      [hashToken(token), id],
    );
    return { id, headers: { cookie: `session=${token}` } };
  }
  const owner = await account(),
    other = await account(),
    url = "/api/v1/profile/communications/history";
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.deepEqual(
      (await app.inject({ url, headers: owner.headers })).json(),
      { items: [], nextCursor: null },
    );
    for (let i = 0; i < 23; i++) {
      const payload = {
        language: "en",
        marketingEmail: i % 2 === 0,
        version: i,
        consentVersion: 1,
      };
      const r = await app.inject({
        url: "/api/v1/profile/communications",
        method: "PUT",
        headers: owner.headers,
        payload,
      });
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(
        (
          await app.inject({
            url: "/api/v1/profile/communications",
            method: "PUT",
            headers: owner.headers,
            payload,
          })
        ).statusCode,
        200,
      );
    }
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/profile/communications",
          method: "PUT",
          headers: owner.headers,
          payload: {
            language: "hi",
            marketingEmail: true,
            version: 23,
            consentVersion: 1,
          },
        })
      ).statusCode,
      200,
    );
    const { consentHistoryPage } =
      await import("../src/modules/profiles/adapters/communication-schema.ts");
    const first = consentHistoryPage.parse(
      (await app.inject({ url, headers: owner.headers })).json(),
    );
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, 4);
    const second = consentHistoryPage.parse(
      (
        await app.inject({
          url: url + "?beforeVersion=4",
          headers: owner.headers,
        })
      ).json(),
    );
    assert.equal(second.items.length, 3);
    assert.equal(second.nextCursor, null);
    const items = [...first.items, ...second.items];
    assert.deepEqual(
      items.map((i) => i.preferenceVersion),
      Array.from({ length: 23 }, (_, i) => 23 - i),
    );
    items.forEach((i) => {
      assert.equal(i.granted, i.preferenceVersion % 2 === 1);
      assert.equal(i.policyVersion, 1);
      assert.equal(i.purpose, "marketing_email");
    });
    assert(!JSON.stringify(first).includes(owner.id));
    assert.deepEqual(
      (
        await app.inject({
          url: url + "?beforeVersion=4",
          headers: other.headers,
        })
      ).json(),
      { items: [], nextCursor: null },
    );
    for (const suffix of [
      "?beforeVersion=0",
      "?beforeVersion=-1",
      "?beforeVersion=1.5",
      "?beforeVersion=01",
      "?beforeVersion=2147483648",
      "?beforeVersion=1e3",
      "?accountId=" + owner.id,
    ])
      assert.equal(
        (await app.inject({ url: url + suffix, headers: owner.headers }))
          .statusCode,
        422,
      );
    await assert.rejects(
      pool.query(
        "UPDATE profiles.marketing_consent_history SET granted=false WHERE account_id=$1",
        [owner.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM profiles.marketing_consent_history WHERE account_id=$1",
        [owner.id],
      ),
      /immutable/,
    );
    const current = (
      await app.inject({
        url: "/api/v1/profile/communications",
        headers: owner.headers,
      })
    ).json();
    assert.equal(current.version, 24);
    assert.equal(current.marketingEmail, true);
  } finally {
    await app.close();
  }
});
