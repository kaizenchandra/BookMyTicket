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
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function fixture() {
  const app = await buildApp();
  async function account(staff = false, mfa = true) {
    const id = randomUUID(),
      token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, `${id}@fixture.invalid`],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
      [hashToken(token), id, mfa],
    );
    if (staff)
      await pool.query(
        "INSERT INTO identity.grants VALUES($1,'support','platform')",
        [id],
      );
    return { id, headers: { cookie: `session=${token}` } };
  }
  const owner = await account(),
    agent = await account(true),
    other = await account(true),
    stranger = await account(),
    noMfa = await account(true, false);
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/cases",
    headers: owner.headers,
    payload: {
      subject: "ISOLATED SUPPORT FIXTURE",
      category: "booking",
      body: "Fixture support question, not a real customer.",
    },
  });
  assert.equal(created.statusCode, 200, created.body);
  const id = created.json().id;
  const action = (
    actor: typeof owner,
    version: number,
    action: string,
    extra = {},
  ) =>
    app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${id}/actions`,
      headers: actor.headers,
      payload: { version, action, reason: "Isolated test reason", ...extra },
    });
  const detail = () =>
    app.inject({
      method: "GET",
      url: `/api/v1/operations/cases/${id}`,
      headers: agent.headers,
    });
  return { app, owner, agent, other, stranger, noMfa, id, action, detail };
}
test("support lifecycle, audience privacy, access controls and audit persist through real HTTP", async () => {
  const f = await fixture();
  try {
    for (const actor of [f.owner, f.stranger, f.noMfa])
      assert.equal(
        (
          await f.app.inject({
            method: "GET",
            url: `/api/v1/operations/cases/${f.id}`,
            headers: actor.headers,
          })
        ).statusCode,
        403,
      );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: `/api/v1/cases/${f.id}/messages`,
          headers: f.stranger.headers,
        })
      ).statusCode,
      404,
    );
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 200);
    assert.equal((await f.action(f.other, 2, "resolve")).statusCode, 409);
    const note = await f.app.inject({
      method: "POST",
      url: `/api/v1/operations/cases/${f.id}/messages`,
      headers: f.agent.headers,
      payload: {
        version: 2,
        audience: "internal",
        body: "INTERNAL FIXTURE SECRET",
      },
    });
    assert.equal(note.statusCode, 200, note.body);
    const customer = await f.app.inject({
      method: "GET",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
    });
    assert.ok(!customer.body.includes("INTERNAL FIXTURE SECRET"));
    const reply = () =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/operations/cases/${f.id}/messages`,
        headers: f.agent.headers,
        payload: {
          version: 3,
          audience: "customer",
          body: "CUSTOMER FIXTURE REPLY",
        },
      });
    assert.equal((await reply()).statusCode, 200);
    assert.equal((await reply()).statusCode, 409);
    assert.equal(
      (await f.action(f.agent, 4, "priority", { priority: "urgent" }))
        .statusCode,
      200,
    );
    assert.equal((await f.action(f.agent, 5, "escalate")).statusCode, 200);
    const queue = await f.app.inject({
      method: "GET",
      url: "/api/v1/operations/cases?state=escalated&priority=urgent&assignment=unassigned&category=booking",
      headers: f.agent.headers,
    });
    assert.ok(queue.json().items.some((r: any) => r.id === f.id));
    assert.equal((await f.action(f.other, 6, "claim")).statusCode, 200);
    assert.equal((await f.action(f.other, 7, "resolve")).statusCode, 200);
    assert.equal(
      (await f.action(f.other, 8, "priority", { priority: "low" })).statusCode,
      409,
    );
    // A genuine customer reply reopens a resolved case and invalidates stale staff actions.
    const incoming = await f.app.inject({
      method: "POST",
      url: `/api/v1/cases/${f.id}/messages`,
      headers: f.owner.headers,
      payload: { body: "Still need assistance." },
    });
    assert.equal(incoming.statusCode, 200);
    const d = (await f.detail()).json();
    assert.equal(d.state, "open");
    assert.equal(d.assigned_to, null);
    assert.equal(d.version, 9);
    assert.ok(d.messages.some((m: any) => m.audience === "internal"));
    assert.equal((await f.action(f.other, 8, "reopen")).statusCode, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='support.case.reply'",
          [f.id],
        )
      ).rows[0].n,
      2,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      f.agent.id,
    ]);
    assert.equal((await f.detail()).statusCode, 403);
  } finally {
    await f.app.close();
  }
});
test("simultaneous claims and a lost-response retry cannot overwrite the winner", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([
      f.action(f.agent, 1, "claim"),
      f.action(f.other, 1, "claim"),
    ]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    const d = (await f.detail()).json();
    assert.equal(d.version, 2);
    assert.ok([f.agent.id, f.other.id].includes(d.assigned_to));
    assert.equal((await f.action(f.agent, 1, "claim")).statusCode, 409);
    assert.equal((await f.detail()).json().version, 2);
  } finally {
    await f.app.close();
  }
});
