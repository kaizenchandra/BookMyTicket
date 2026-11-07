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
async function fixture() {
  const owner = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const token = randomBytes(24).toString("hex");
    const row = (
      await pool.query(
        "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour') RETURNING id",
        [hashToken(token), owner],
      )
    ).rows[0];
    sessions.push({ token, id: row.id });
  }
  return { owner, sessions };
}
test("Session listing is private, token-free, owner scoped and identifies current session", async () => {
  const a = await fixture(),
    b = await fixture(),
    app = await buildApp();
  try {
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/v1/auth/sessions" }))
        .statusCode,
      401,
    );
    const r = await app.inject({
      method: "GET",
      url: "/api/v1/auth/sessions",
      headers: { cookie: `session=${a.sessions[0].token}` },
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.json().items.length, 3);
    assert.equal(r.json().items.filter((s: any) => s.current).length, 1);
    assert(!r.body.includes("token_hash"));
    assert(!r.body.includes(a.sessions[0].token));
    assert(!r.body.includes(b.sessions[0].id));
  } finally {
    await app.close();
  }
});
test("Single-session revocation is idempotent, immediate and cannot revoke another account", async () => {
  const a = await fixture(),
    b = await fixture(),
    app = await buildApp(),
    headers = { cookie: `session=${a.sessions[0].token}` };
  try {
    for (let i = 0; i < 2; i++)
      assert.equal(
        (
          await app.inject({
            method: "DELETE",
            url: `/api/v1/auth/sessions/${a.sessions[1].id}`,
            headers,
          })
        ).statusCode,
        200,
      );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/me",
          headers: { cookie: `session=${a.sessions[1].token}` },
        })
      ).statusCode,
      401,
    );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/auth/sessions/${b.sessions[0].id}`,
          headers,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/me",
          headers: { cookie: `session=${b.sessions[0].token}` },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/v1/auth/sessions/${a.sessions[0].id}`,
          headers,
        })
      ).json().code,
      "USE_LOGOUT",
    );
    const audit = (
      await pool.query(
        "SELECT details FROM reporting.audit WHERE actor_id=$1 AND action='sessions.revoked'",
        [a.owner],
      )
    ).rows;
    assert.equal(audit.length, 1);
    assert(!JSON.stringify(audit).includes(a.sessions[1].token));
  } finally {
    await app.close();
  }
});
test("Revoke others preserves current session and rejects a suspended account", async () => {
  const a = await fixture(),
    app = await buildApp(),
    headers = { cookie: `session=${a.sessions[0].token}` };
  try {
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/sessions/revoke-others",
          headers,
          payload: {},
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/auth/sessions",
          headers,
        })
      ).json().items.length,
      1,
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [a.owner],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/auth/sessions",
          headers,
        })
      ).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
