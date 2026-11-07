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
  async function actor() {
    const id = randomUUID(),
      email = `${id}@fixture.invalid`,
      token = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
      [id, email],
    );
    await pool.query(
      "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
      [hashToken(token), id],
    );
    return { id, email, headers: { cookie: `session=${token}` } };
  }
  const owner = await actor(),
    member = await actor(),
    stranger = await actor();
  const created = await app.inject({
    method: "POST",
    url: "/api/v1/organizations",
    headers: owner.headers,
    payload: { name: "ISOLATED STAFF FIXTURE", kind: "cinema" },
  });
  assert.equal(created.statusCode, 200, created.body);
  const org = created.json().id;
  const invite = (key = randomUUID(), role = "editor") =>
    app.inject({
      method: "POST",
      url: `/api/v1/organizations/${org}/invitations`,
      headers: { ...owner.headers, "idempotency-key": key },
      payload: { email: member.email.toUpperCase(), role },
    });
  const accept = (id: string, who = member) =>
    app.inject({
      method: "POST",
      url: `/api/v1/provider-invitations/${id}/accept`,
      headers: who.headers,
      payload: {},
    });
  const staff = () =>
    app.inject({
      method: "GET",
      url: `/api/v1/organizations/${org}/staff`,
      headers: owner.headers,
    });
  const change = (version: number, role: string, id = member.id) =>
    app.inject({
      method: "PUT",
      url: `/api/v1/organizations/${org}/staff/${id}`,
      headers: owner.headers,
      payload: { version, role },
    });
  return { app, owner, member, stranger, org, invite, accept, staff, change };
}
test("verified recipient acceptance, owner-only roles, immediate revocation and safe replay", async () => {
  const f = await fixture();
  try {
    const key = randomUUID(),
      first = await f.invite(key);
    assert.equal(first.statusCode, 200, first.body);
    const id = first.json().id;
    assert.equal((await f.invite(key)).json().id, id);
    assert.equal((await f.invite(key, "viewer")).statusCode, 409);
    assert.equal((await f.invite()).statusCode, 409);
    assert.equal((await f.accept(id, f.stranger)).statusCode, 404);
    const inbox = await f.app.inject({
      method: "GET",
      url: "/api/v1/provider-invitations",
      headers: f.member.headers,
    });
    assert.ok(inbox.json().items.some((r: any) => r.id === id));
    const results = await Promise.all([f.accept(id), f.accept(id)]);
    assert.ok(results.every((r) => r.statusCode === 200));
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: `/api/v1/organizations/${f.org}/staff`,
          headers: f.member.headers,
        })
      ).statusCode,
      403,
    );
    const write = () =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/organizations/${f.org}/listings`,
        headers: f.member.headers,
        payload: {
          title: "ISOLATED STAFF MOVIE",
          kind: "movie",
          city: "Test city",
          description: "Isolated staff fixture listing",
          metadata: {},
        },
      });
    assert.equal((await write()).statusCode, 200);
    let m = (await f.staff())
      .json()
      .members.find((r: any) => r.account_id === f.member.id);
    const oldVersion = Number(m.version);
    assert.equal((await f.change(oldVersion, "viewer")).statusCode, 200);
    assert.equal((await write()).statusCode, 403);
    m = (await f.staff())
      .json()
      .members.find((r: any) => r.account_id === f.member.id);
    assert.equal((await f.change(Number(m.version), "revoke")).statusCode, 200);
    assert.equal(
      (await f.accept(id)).statusCode,
      200,
      "accepted replay returns original outcome but never recreates membership",
    );
    assert.equal((await write()).statusCode, 403);
    const next = await f.invite();
    assert.equal((await f.accept(next.json().id)).statusCode, 200);
    assert.equal(
      (await f.change(oldVersion, "revoke")).statusCode,
      409,
      "old membership version cannot revoke a newly accepted membership",
    );
    const owner = (await f.staff())
      .json()
      .members.find((r: any) => r.account_id === f.owner.id);
    assert.equal(
      (await f.change(Number(owner.version), "revoke", f.owner.id)).statusCode,
      403,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE action='provider.staff.accepted' AND target=$1",
          [f.org],
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await f.app.close();
  }
});
test("expired/revoked invitations cannot grant access and cross-tenant staff mutations fail", async () => {
  const f = await fixture();
  try {
    const invitation = (await f.invite()).json();
    await pool.query(
      "UPDATE providers.invitations SET expires_at=now()-interval '1 second' WHERE id=$1",
      [invitation.id],
    );
    assert.equal((await f.accept(invitation.id)).statusCode, 409);
    const next = (await f.invite()).json();
    const revoked = await f.app.inject({
      method: "POST",
      url: `/api/v1/organizations/${f.org}/invitations/${next.id}/revoke`,
      headers: f.owner.headers,
      payload: { version: 1 },
    });
    assert.equal(revoked.statusCode, 200);
    assert.equal((await f.accept(next.id)).statusCode, 409);
    const denied = await f.app.inject({
      method: "POST",
      url: `/api/v1/organizations/${f.org}/invitations`,
      headers: { ...f.stranger.headers, "idempotency-key": randomUUID() },
      payload: { email: f.member.email, role: "editor" },
    });
    assert.equal(denied.statusCode, 403);
    const invalid = await f.app.inject({
      method: "POST",
      url: `/api/v1/organizations/${f.org}/invitations`,
      headers: { ...f.owner.headers, "idempotency-key": randomUUID() },
      payload: { email: f.member.email, role: "owner" },
    });
    assert.equal(invalid.statusCode, 422);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.owner.id],
    );
    assert.equal((await f.invite()).statusCode, 403);
    assert.equal((await f.staff()).statusCode, 403);
  } finally {
    await f.app.close();
  }
});
