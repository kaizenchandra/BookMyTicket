import { consentPolicies } from "../src/modules/profiles/domain/consent-policies.ts";
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
async function account() {
  const id = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), id],
  );
  return { id, headers: { cookie: `session=${token}` } };
}
test("Profile edits serialize first saves, preserve identical retries and reject stale overwrite", async () => {
  const app = await buildApp(),
    a = await account(),
    b = await account();
  const get = (headers = a.headers) =>
    app.inject({ url: "/api/v1/profile", headers });
  const put = (
    payload: Record<string, unknown>,
    headers: Record<string, string> = a.headers,
  ) => app.inject({ method: "PUT", url: "/api/v1/profile", headers, payload });
  try {
    assert.deepEqual((await get()).json(), {
      name: "",
      theme: "LIGHT",
      city: null,
      version: 0,
    });
    const input = {
      name: "First",
      city: "Bengaluru",
      theme: "LIGHT",
      expectedVersion: 0,
    };
    assert.equal((await put(input, {})).statusCode, 401);
    const results = await Promise.all([
      put(input),
      put({ ...input, name: "Second" }),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const saved = (await get()).json();
    assert.equal(saved.version, 1);
    const retry = {
      name: saved.name,
      theme: saved.theme,
      city: saved.city,
      expectedVersion: 0,
    };
    const repeated = await Promise.all(
      Array.from({ length: 5 }, () => put(retry)),
    );
    assert(
      repeated.every((r) => r.statusCode === 200 && r.json().version === 1),
    );
    assert.equal((await put({ ...input, name: "Stale" })).statusCode, 409);
    assert.deepEqual((await get(b.headers)).json(), {
      name: "",
      theme: "LIGHT",
      city: null,
      version: 0,
    });
    const changed = await put({
      name: "  Updated  ",
      city: null,
      theme: "DARK",
      expectedVersion: 1,
    });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.deepEqual(changed.json(), {
      name: "Updated",
      city: null,
      theme: "DARK",
      version: 2,
    });
    assert.equal((await put(retry)).statusCode, 409);
    for (const patch of [
      { expectedVersion: undefined },
      { expectedVersion: -1 },
      { expectedVersion: 2147483647 },
      { city: " " },
      { city: "x".repeat(101) },
      { name: "x".repeat(101) },
      { theme: "SYSTEM" },
      { accountId: b.id },
    ])
      assert.equal(
        (await put({ ...input, expectedVersion: 2, ...patch })).statusCode,
        422,
      );
    assert.equal((await get()).json().version, 2);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [a.id],
    );
    assert.equal((await get()).statusCode, 401);
    assert.equal((await put({ ...input, expectedVersion: 2 })).statusCode, 401);
  } finally {
    await app.close();
  }
});

test("Saved attendees require consent, encrypt private data, isolate accounts and withdraw without retaining details", async () => {
  const oldKey = process.env.REGISTRATION_ENCRYPTION_KEY;
  process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const app = await buildApp(),
    a = await account(),
    b = await account();
  const item = {
    id: randomUUID(),
    name: "Private Attendee",
    email: "private@fixture.invalid",
    phone: "+919876543210",
  };
  const input = {
    expectedVersion: 0,
    consentVersion: 1,
    consent: true,
    items: [item],
  };
  const get = (headers: Record<string, string> = a.headers) =>
    app.inject({ url: "/api/v1/profile/attendees", headers });
  const put = (
    payload: Record<string, unknown>,
    headers: Record<string, string> = a.headers,
  ) =>
    app.inject({
      method: "PUT",
      url: "/api/v1/profile/attendees",
      headers,
      payload,
    });
  try {
    assert.equal((await get({})).statusCode, 401);
    assert.equal((await put(input, {})).statusCode, 401);
    assert.deepEqual((await get()).json(), {
      version: 0,
      consentVersion: 1,
      consent: false,
      items: [],
    });
    for (const patch of [
      { consent: false },
      { consentVersion: 2 },
      { items: [item, item] },
      { items: [] },
      {
        items: Array.from({ length: 11 }, () => ({
          ...item,
          id: randomUUID(),
        })),
      },
      { items: [{ ...item, email: "invalid" }] },
      { accountId: b.id },
    ])
      assert.equal((await put({ ...input, ...patch })).statusCode, 422);
    const saves = await Promise.all(
      Array.from({ length: 6 }, () => put(input)),
    );
    assert(saves.every((r) => r.statusCode === 200 && r.json().version === 1));
    const raw = (
      await pool.query(
        "SELECT ciphertext FROM profiles.saved_attendees WHERE account_id=$1",
        [a.id],
      )
    ).rows[0].ciphertext;
    assert(!raw.includes(item.name));
    assert(!raw.includes(item.email));
    assert.deepEqual((await get()).json().items, [item]);
    assert.deepEqual((await get(b.headers)).json().items, []);
    const history = (
      await pool.query(
        "SELECT purpose,policy_version,granted,preference_version FROM profiles.attendee_consent_history WHERE account_id=$1",
        [a.id],
      )
    ).rows;
    assert.deepEqual(history, [
      {
        purpose: "saved_attendees",
        policy_version: 1,
        granted: true,
        preference_version: 1,
      },
    ]);
    assert.equal(
      (await put({ ...input, items: [{ ...item, name: "Changed" }] }))
        .statusCode,
      409,
    );
    await pool.query(
      "INSERT INTO profiles.saved_attendees(account_id,ciphertext,version) VALUES($1,$2,1)",
      [b.id, raw],
    );
    const swapped = await get(b.headers);
    assert.equal(swapped.statusCode, 503);
    assert(!swapped.body.includes(item.name));
    await pool.query(
      "DELETE FROM profiles.saved_attendees WHERE account_id=$1",
      [b.id],
    );
    delete process.env.REGISTRATION_ENCRYPTION_KEY;
    assert.equal((await get()).statusCode, 503);
    assert.equal(
      (
        await put({
          ...input,
          expectedVersion: 1,
          items: [{ ...item, name: "New" }],
        })
      ).statusCode,
      503,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT version FROM profiles.saved_attendees WHERE account_id=$1",
          [a.id],
        )
      ).rows[0].version,
      1,
    );
    const withdrawal = {
      expectedVersion: 1,
      consentVersion: 1,
      consent: false,
      items: [],
    };
    assert.equal((await put(withdrawal)).statusCode, 200);
    assert.equal((await put(withdrawal)).json().version, 2);
    assert.deepEqual((await get()).json(), {
      version: 2,
      consentVersion: 1,
      consent: false,
      items: [],
    });
    assert.equal(
      (
        await pool.query(
          "SELECT ciphertext FROM profiles.saved_attendees WHERE account_id=$1",
          [a.id],
        )
      ).rows[0].ciphertext,
      null,
    );
    const withdrawn = (
      await pool.query(
        "SELECT granted FROM profiles.attendee_consent_history WHERE account_id=$1 ORDER BY preference_version",
        [a.id],
      )
    ).rows;
    assert.deepEqual(withdrawn, [{ granted: true }, { granted: false }]);
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [a.id],
    );
    assert.equal((await get()).statusCode, 401);
  } finally {
    await app.close();
    if (oldKey === undefined) delete process.env.REGISTRATION_ENCRYPTION_KEY;
    else process.env.REGISTRATION_ENCRYPTION_KEY = oldKey;
  }
});

test("Saved attendee consent history survives withdrawal without exposing private details", async () => {
  const oldKey = process.env.REGISTRATION_ENCRYPTION_KEY;
  process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const app = await buildApp(),
    owner = await account(),
    other = await account();
  const url = "/api/v1/profile/attendees/consent-history",
    item = {
      id: randomUUID(),
      name: "Private history attendee",
      email: "history-private@fixture.invalid",
      phone: "+919876543210",
    };
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.deepEqual(
      (await app.inject({ url, headers: owner.headers })).json(),
      { items: [], nextCursor: null },
    );
    for (let i = 0; i < 24; i++) {
      const input = {
        expectedVersion: i,
        consentVersion: 1,
        consent: i % 2 === 0,
        items: i % 2 === 0 ? [item] : [],
      };
      const save = () =>
        app.inject({
          method: "PUT",
          url: "/api/v1/profile/attendees",
          headers: owner.headers,
          payload: input,
        });
      const r = await save();
      assert.equal(r.statusCode, 200, r.body);
      assert.equal((await save()).statusCode, 200);
    }
    assert.equal(
      (
        await pool.query(
          "SELECT ciphertext FROM profiles.saved_attendees WHERE account_id=$1",
          [owner.id],
        )
      ).rows[0].ciphertext,
      null,
    );
    // History uses only consent metadata and must not depend on decryption availability.
    delete process.env.REGISTRATION_ENCRYPTION_KEY;
    const { attendeeConsentHistoryPage } =
      await import("../src/modules/profiles/adapters/saved-attendees-schema.ts");
    const first = attendeeConsentHistoryPage.parse(
      (await app.inject({ url, headers: owner.headers })).json(),
    );
    assert.equal(first.items.length, 20);
    assert.equal(first.nextCursor, 5);
    const second = attendeeConsentHistoryPage.parse(
      (
        await app.inject({
          url: url + "?beforeVersion=5",
          headers: owner.headers,
        })
      ).json(),
    );
    assert.equal(second.items.length, 4);
    assert.equal(second.nextCursor, null);
    const items = [...first.items, ...second.items];
    assert.deepEqual(
      items.map((i) => i.preferenceVersion),
      Array.from({ length: 24 }, (_, i) => 24 - i),
    );
    items.forEach((i) => {
      assert.equal(i.granted, i.preferenceVersion % 2 === 1);
      assert.equal(i.purpose, "saved_attendees");
      assert.equal(i.policyText, consentPolicies.saved_attendees.text);
      assert.equal(i.policyVersion, 1);
    });
    for (const value of [owner.id, ...Object.values(item)])
      assert(!JSON.stringify(items).includes(value));
    assert.deepEqual(
      (
        await app.inject({
          url: url + "?beforeVersion=5",
          headers: other.headers,
        })
      ).json(),
      { items: [], nextCursor: null },
    );
    await pool.query(
      "INSERT INTO profiles.attendee_consent_history(account_id,preference_version,purpose,policy_version,granted) VALUES($1,1,'saved_attendees',1,true)",
      [other.id],
    );
    assert.equal(
      (await app.inject({ url, headers: other.headers })).json().items[0]
        .policyText,
      null,
    );
    await assert.rejects(
      pool.query(
        "UPDATE profiles.attendee_consent_history SET policy_text='Rewritten' WHERE account_id=$1",
        [owner.id],
      ),
      /immutable/,
    );
    for (const suffix of [
      "?beforeVersion=0",
      "?beforeVersion=1.5",
      "?beforeVersion=01",
      "?beforeVersion=2147483648",
      "?accountId=" + owner.id,
    ])
      assert.equal(
        (await app.inject({ url: url + suffix, headers: owner.headers }))
          .statusCode,
        422,
      );
    await assert.rejects(
      pool.query(
        "UPDATE profiles.attendee_consent_history SET granted=false WHERE account_id=$1",
        [owner.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM profiles.attendee_consent_history WHERE account_id=$1",
        [owner.id],
      ),
      /immutable/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM profiles.attendee_consent_history WHERE account_id=$1",
          [owner.id],
        )
      ).rows[0].n,
      24,
    );
  } finally {
    if (oldKey === undefined) delete process.env.REGISTRATION_ENCRYPTION_KEY;
    else process.env.REGISTRATION_ENCRYPTION_KEY = oldKey;
    await app.close();
  }
});
