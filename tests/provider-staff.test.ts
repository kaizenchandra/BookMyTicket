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
    headers: { ...owner.headers, "idempotency-key": randomUUID() },
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
        headers: { ...f.member.headers, "idempotency-key": randomUUID() },
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

test("Owner invitation history pages preserve exact boundaries and current authorization", async () => {
  const f = await fixture();
  const path = `/api/v1/organizations/${f.org}/staff`;
  const page = (query = "", headers = f.owner.headers) =>
    f.app.inject({ method: "GET", url: path + query, headers });
  try {
    for (let i = 0; i < 105; i++) {
      await pool.query(
        "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key,created_at,expires_at,state) VALUES($1,$2,$3,'viewer',$4,$5,'2026-01-02T03:04:05.123456Z',now()+interval '1 day',$6)",
        [
          randomUUID(),
          f.org,
          `page-${i}@fixture.invalid`,
          f.owner.id,
          randomUUID(),
          i % 3 === 0 ? "revoked" : "pending",
        ],
      );
    }
    // A microsecond-newer row exercises precision that JavaScript dates would lose.
    const newest = randomUUID();
    await pool.query(
      "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key,created_at,expires_at) VALUES($1,$2,'expired@fixture.invalid','editor',$3,$4,'2026-01-02T03:04:05.123457Z',now()-interval '1 day')",
      [newest, f.org, f.owner.id, randomUUID()],
    );
    const { staffPageResponse } =
      await import("../src/modules/providers/adapters/staff-schema.ts");
    let query = "",
      seen: string[] = [],
      first: any;
    const sizes: number[] = [];
    do {
      const response = await page(query);
      assert.equal(response.statusCode, 200, response.body);
      const body = staffPageResponse.parse(response.json());
      first ??= body;
      sizes.push(body.invitations.length);
      assert.equal(body.members.length, 1);
      seen.push(...body.invitations.map((i) => i.id));
      query = body.nextCursor ? `?${new URLSearchParams(body.nextCursor)}` : "";
    } while (query);
    assert.deepEqual(sizes, [20, 20, 20, 20, 20, 6]);
    assert.equal(new Set(seen).size, 106);
    assert.equal(first.invitations[0].id, newest);
    assert.equal(first.invitations[0].state, "expired");
    assert.equal(first.invitations[0].createdAt, "2026-01-02T03:04:05.123457Z");
    const expected = (
      await pool.query(
        "SELECT id FROM providers.invitations WHERE organization_id=$1 ORDER BY created_at DESC,id DESC",
        [f.org],
      )
    ).rows.map((r) => r.id);
    assert.deepEqual(seen, expected);
    assert.deepEqual((await page()).json().invitations, first.invitations);
    for (const invalid of [
      "?afterId=" + newest,
      "?afterCreatedAt=2026-01-02T03:04:05.123456Z",
      "?afterId=no&afterCreatedAt=2026-01-02T03:04:05.123456Z",
      "?afterId=" + newest + "&afterCreatedAt=2026-01-02T03:04:05.123Z",
      "?unknown=true",
    ])
      assert.equal((await page(invalid)).statusCode, 422);
    assert.equal((await page("", f.stranger.headers)).statusCode, 403);
    assert.equal(
      (await f.app.inject({ method: "GET", url: path })).statusCode,
      401,
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.owner.id],
    );
    assert.equal((await page()).statusCode, 403);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=now() WHERE account_id=$1",
      [f.owner.id],
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner.id],
    );
    assert.equal(
      (await page(`?${new URLSearchParams(first.nextCursor)}`)).statusCode,
      403,
    );
  } finally {
    await f.app.close();
  }
});

test("Recipient invitation pages reach older invitations without exposing other contacts or unavailable records", async () => {
  const f = await fixture();
  try {
    const ids: string[] = [];
    for (let i = 0; i < 103; i++) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key,created_at) VALUES($1,$2,$3,'viewer',$4,$5,'2026-01-02T03:04:05.123456Z')",
        [id, f.org, f.member.email, f.owner.id, randomUUID()],
      );
    }
    for (const [email, state, expiry] of [
      [f.stranger.email, "pending", "1 day"],
      [f.member.email, "revoked", "1 day"],
      [f.member.email, "accepted", "1 day"],
      [f.member.email, "pending", "-1 day"],
    ]) {
      await pool.query(
        "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key,state,expires_at) VALUES($1,$2,$3,'viewer',$4,$5,$6,now()+$7::interval)",
        [randomUUID(), f.org, email, f.owner.id, randomUUID(), state, expiry],
      );
    }
    const { recipientInvitationPage } =
      await import("../src/modules/providers/adapters/staff-schema.ts");
    let query = "",
      cursor: any,
      seen: string[] = [],
      sizes: number[] = [];
    do {
      const r = await f.app.inject({
        method: "GET",
        url: "/api/v1/provider-invitations" + query,
        headers: f.member.headers,
      });
      assert.equal(r.statusCode, 200, r.body);
      const body = recipientInvitationPage.parse(r.json());
      cursor ??= body.nextCursor;
      sizes.push(body.items.length);
      seen.push(...body.items.map((i) => i.id));
      assert(
        body.items.every((i) => i.createdAt === "2026-01-02T03:04:05.123456Z"),
      );
      query = body.nextCursor ? `?${new URLSearchParams(body.nextCursor)}` : "";
    } while (query);
    assert.deepEqual(sizes, [20, 20, 20, 20, 20, 3]);
    assert.deepEqual(seen, [...ids].sort().reverse());
    assert.equal(new Set(seen).size, 103);
    // The older invitation remains actionable with existing recipient authorization.
    assert.equal((await f.accept(seen.at(-1)!)).statusCode, 200);
    const lastQuery = `?afterCreatedAt=2026-01-02T03%3A04%3A05.123456Z&afterId=${seen.at(-4)}`;
    const last = await f.app.inject({
      method: "GET",
      url: "/api/v1/provider-invitations" + lastQuery,
      headers: f.member.headers,
    });
    assert.equal(last.json().items.length, 2);
    const foreign = await f.app.inject({
      method: "GET",
      url: `/api/v1/provider-invitations?${new URLSearchParams(cursor)}`,
      headers: f.stranger.headers,
    });
    assert.equal(foreign.json().items.length, 0);
    for (const query of [
      "?afterId=" + ids[0],
      "?afterCreatedAt=2026-01-02T03:04:05.123456Z",
      "?afterId=bad&afterCreatedAt=bad",
      "?unknown=true",
    ]) {
      assert.equal(
        (
          await f.app.inject({
            method: "GET",
            url: "/api/v1/provider-invitations" + query,
            headers: f.member.headers,
          })
        ).statusCode,
        422,
      );
    }
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/provider-invitations",
        })
      ).statusCode,
      401,
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.member.id],
    );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/provider-invitations",
          headers: f.member.headers,
        })
      ).statusCode,
      200,
    );
  } finally {
    await f.app.close();
  }
});

test("Staff membership commands preserve bigint versions and reject unsafe numeric inputs", async () => {
  const f = await fixture();
  try {
    const invited = await f.invite();
    assert.equal((await f.accept(invited.json().id)).statusCode, 200);
    const path = `/api/v1/organizations/${f.org}/staff/${f.member.id}`;
    const change = (version: unknown, role = "viewer") =>
      f.app.inject({
        method: "PUT",
        url: path,
        headers: f.owner.headers,
        payload: { version, role },
      });
    await pool.query(
      "UPDATE providers.memberships SET version=$3 WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.member.id, "9007199254740993"],
    );
    const exact = (await f.staff())
      .json()
      .members.find((m: any) => m.account_id === f.member.id);
    assert.equal(exact.version, "9007199254740993");
    for (const bad of [
      9007199254740992,
      0,
      -1,
      1.5,
      "0",
      "01",
      "-1",
      "1.5",
      "1e3",
      " 1",
      "9223372036854775808",
      "999999999999999999999",
      null,
    ]) {
      assert.equal((await change(bad)).statusCode, 422, JSON.stringify(bad));
    }
    assert.equal((await change("9007199254740992")).statusCode, 409);
    assert.equal((await change(exact.version)).statusCode, 200);
    assert.equal((await change(exact.version, "revoke")).statusCode, 409);
    const current = (await f.staff())
      .json()
      .members.find((m: any) => m.account_id === f.member.id);
    assert.equal(current.role, "viewer");
    // Retain compatibility for clients that send small safe numeric versions.
    assert.equal(
      (await change(Number(current.version), "editor")).statusCode,
      200,
    );
    await pool.query(
      "UPDATE providers.memberships SET version=$3 WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.member.id, "9223372036854775807"],
    );
    assert.equal(
      (await change("9223372036854775807", "revoke")).statusCode,
      200,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
          [f.org, f.member.id],
        )
      ).rowCount,
      0,
    );
  } finally {
    await f.app.close();
  }
});

test("Member pages preserve independent invitation cursors and authorized role actions", async () => {
  const f = await fixture();
  const url = `/api/v1/organizations/${f.org}/staff`;
  try {
    const ids = [f.owner.id];
    for (let i = 0; i < 45; i++) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
        [id, `${id}@fixture.invalid`],
      );
      await pool.query(
        "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'viewer')",
        [f.org, id],
      );
    }
    for (let i = 0; i < 21; i++)
      await pool.query(
        "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key) VALUES($1,$2,$3,'viewer',$4,$5)",
        [randomUUID(), f.org, `${i}@fixture.invalid`, f.owner.id, randomUUID()],
      );
    const { staffPageResponse } =
      await import("../src/modules/providers/adapters/staff-schema.ts");
    const page = (query = "", headers = f.owner.headers) =>
      f.app.inject({ method: "GET", url: url + query, headers });
    let query = "",
      seen: string[] = [],
      sizes: number[] = [],
      first: any,
      last: any;
    do {
      const r = await page(query);
      assert.equal(r.statusCode, 200, r.body);
      const body = staffPageResponse.parse(r.json());
      first ??= body;
      last = body;
      sizes.push(body.members.length);
      seen.push(...body.members.map((m) => m.account_id));
      assert.deepEqual(body.invitations, first.invitations);
      query = body.nextMemberCursor
        ? `?${new URLSearchParams(body.nextMemberCursor)}`
        : "";
    } while (query);
    assert.deepEqual(sizes, [20, 20, 6]);
    assert.deepEqual(seen, [...ids].sort());
    assert.equal(new Set(seen).size, 46);
    const combined = new URLSearchParams({
      ...first.nextCursor,
      ...first.nextMemberCursor,
    });
    const both = staffPageResponse.parse((await page(`?${combined}`)).json());
    assert.equal(both.invitations.length, 1);
    assert.deepEqual(
      both.members.map((m) => m.account_id),
      seen.slice(20, 40),
    );
    const target = last.members.find((m: any) => m.role === "viewer");
    assert(target);
    const changed = await f.app.inject({
      method: "PUT",
      url: `${url}/${target.account_id}`,
      headers: f.owner.headers,
      payload: { version: target.version, role: "editor" },
    });
    assert.equal(changed.statusCode, 200, changed.body);
    const tail = staffPageResponse.parse(
      (await page(`?afterMemberId=${seen[39]}`)).json(),
    );
    const updated = tail.members.find(
      (m) => m.account_id === target.account_id,
    )!;
    assert.equal(updated.role, "editor");
    assert.equal(
      (
        await f.app.inject({
          method: "PUT",
          url: `${url}/${target.account_id}`,
          headers: f.owner.headers,
          payload: { version: updated.version, role: "revoke" },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await page(`?afterMemberId=${seen[39]}`)).json().members.length,
      5,
    );
    assert.equal((await page("?afterMemberId=not-a-uuid")).statusCode, 422);
    assert.equal(
      (await page("?afterMemberId=" + seen[0] + "&afterId=" + randomUUID()))
        .statusCode,
      422,
    );
    assert.equal(
      (await page("?afterMemberId=" + seen[0], f.stranger.headers)).statusCode,
      403,
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.owner.id],
    );
    assert.equal((await page("?afterMemberId=" + seen[0])).statusCode, 403);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=now() WHERE account_id=$1",
      [f.owner.id],
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner.id],
    );
    assert.equal((await page("?afterMemberId=" + seen[0])).statusCode, 403);
  } finally {
    await f.app.close();
  }
});

test("Invitation revocation recovery is atomic, actor scoped and cannot revoke a replacement", async () => {
  const f = await fixture();
  try {
    const invitation = (await f.invite()).json();
    const revoke = (
      id = invitation.id,
      version = 1,
      headers = f.owner.headers,
    ) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/organizations/${f.org}/invitations/${id}/revoke`,
        headers,
        payload: { version },
      });
    const { PostgresProviderStaff } =
      await import("../src/modules/providers/adapters/staff.ts");
    const failing = new PostgresProviderStaff({
      record: async () => {
        throw new Error("fixture audit failure");
      },
    });
    await assert.rejects(
      failing.revoke(
        { id: f.owner.id, contact: f.owner.email, mfaVerified: true },
        f.org,
        invitation.id,
        1,
      ),
      /fixture audit failure/,
    );
    assert.deepEqual(
      (
        await pool.query(
          "SELECT state,version FROM providers.invitations WHERE id=$1",
          [invitation.id],
        )
      ).rows[0],
      { state: "pending", version: 1 },
    );
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM providers.invitation_revocations WHERE invitation_id=$1",
          [invitation.id],
        )
      ).rowCount,
      0,
    );
    for (const version of [0, -1, 1.5, 2147483647])
      assert.equal((await revoke(invitation.id, version)).statusCode, 422);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => revoke()),
    );
    responses.forEach((r) => {
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json(), { id: invitation.id, state: "revoked" });
    });
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM providers.invitation_revocations WHERE invitation_id=$1",
          [invitation.id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='provider.staff.invitation_revoked'",
          [f.org],
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await revoke(invitation.id, 2)).statusCode, 409);
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [f.org, f.stranger.id],
    );
    assert.equal(
      (await revoke(invitation.id, 1, f.stranger.headers)).statusCode,
      409,
    );
    const replacement = (await f.invite()).json();
    assert.equal((await f.accept(replacement.id)).statusCode, 200);
    assert.equal((await revoke()).statusCode, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM providers.invitations WHERE id=$1",
          [replacement.id],
        )
      ).rows[0].state,
      "accepted",
    );
    assert.equal(
      (
        await pool.query(
          "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
          [f.org, f.member.id],
        )
      ).rows[0].role,
      "editor",
    );
    await assert.rejects(
      pool.query(
        "UPDATE providers.invitation_revocations SET input_version=2 WHERE invitation_id=$1",
        [invitation.id],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM providers.invitation_revocations WHERE invitation_id=$1",
        [invitation.id],
      ),
      /immutable/,
    );
    await pool.query(
      "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.member.id],
    );
    const raced = (await f.invite()).json();
    const results = await Promise.all([f.accept(raced.id), revoke(raced.id)]);
    assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.owner.id],
    );
    assert.equal((await revoke()).statusCode, 403);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=now() WHERE account_id=$1",
      [f.owner.id],
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner.id],
    );
    assert.equal((await revoke()).statusCode, 403);
  } finally {
    await f.app.close();
  }
});

test("Membership action recovery is atomic and preserves later roles and replacement membership", async () => {
  const f = await fixture();
  try {
    const invited = (await f.invite()).json();
    assert.equal((await f.accept(invited.id)).statusCode, 200);
    const member = async () =>
      (await f.staff())
        .json()
        .members.find((m: any) => m.account_id === f.member.id);
    const original = await member();
    const command = (
      version: string,
      role: string,
      headers = f.owner.headers,
    ) =>
      f.app.inject({
        method: "PUT",
        url: `/api/v1/organizations/${f.org}/staff/${f.member.id}`,
        headers,
        payload: { version, role },
      });
    const { PostgresProviderStaff } =
      await import("../src/modules/providers/adapters/staff.ts");
    const failing = new PostgresProviderStaff({
      record: async () => {
        throw new Error("fixture audit failure");
      },
    });
    await assert.rejects(
      failing.member(
        { id: f.owner.id, contact: f.owner.email, mfaVerified: true },
        f.org,
        f.member.id,
        original.version,
        "viewer",
      ),
      /fixture audit failure/,
    );
    assert.deepEqual(await member(), original);
    assert.equal(
      (
        await pool.query(
          "SELECT 1 FROM providers.membership_commands WHERE organization_id=$1",
          [f.org],
        )
      ).rowCount,
      0,
    );
    const replies = await Promise.all(
      Array.from({ length: 6 }, () => command(original.version, "viewer")),
    );
    replies.forEach((r) => {
      assert.equal(r.statusCode, 200, r.body);
      assert.deepEqual(r.json(), { accountId: f.member.id, role: "viewer" });
    });
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM providers.membership_commands WHERE organization_id=$1",
          [f.org],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.audit WHERE target=$1 AND action='provider.staff.membership_changed'",
          [f.org],
        )
      ).rows[0].n,
      1,
    );
    assert.equal((await command(original.version, "revoke")).statusCode, 409);
    await pool.query(
      "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
      [f.org, f.stranger.id],
    );
    assert.equal(
      (await command(original.version, "viewer", f.stranger.headers))
        .statusCode,
      409,
    );
    const viewer = await member();
    assert.equal((await command(viewer.version, "editor")).statusCode, 200);
    const editor = await member();
    assert.equal((await command(original.version, "viewer")).statusCode, 200);
    assert.deepEqual(await member(), editor);
    await assert.rejects(
      failing.member(
        { id: f.owner.id, contact: f.owner.email, mfaVerified: true },
        f.org,
        f.member.id,
        editor.version,
        "revoke",
      ),
      /fixture audit failure/,
    );
    assert.deepEqual(await member(), editor);
    assert.equal((await command(editor.version, "revoke")).statusCode, 200);
    assert.equal(await member(), undefined);
    assert.equal((await command(editor.version, "revoke")).statusCode, 200);
    const replacement = (await f.invite()).json();
    assert.equal((await f.accept(replacement.id)).statusCode, 200);
    const restored = await member();
    assert.notEqual(restored.version, editor.version);
    assert.equal((await command(editor.version, "revoke")).statusCode, 200);
    assert.equal((await command(original.version, "viewer")).statusCode, 200);
    assert.deepEqual(await member(), restored);
    await assert.rejects(
      pool.query(
        "UPDATE providers.membership_commands SET action='editor' WHERE organization_id=$1",
        [f.org],
      ),
      /immutable/,
    );
    await assert.rejects(
      pool.query(
        "DELETE FROM providers.membership_commands WHERE organization_id=$1",
        [f.org],
      ),
      /immutable/,
    );
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [f.owner.id],
    );
    assert.equal((await command(editor.version, "revoke")).statusCode, 403);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=now() WHERE account_id=$1",
      [f.owner.id],
    );
    await pool.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner.id],
    );
    assert.equal((await command(editor.version, "revoke")).statusCode, 403);
  } finally {
    await f.app.close();
  }
});

test("Owner invitation filters paginate effective status without filtering members or leaking recipients", async () => {
  const f = await fixture();
  try {
    for (const [state, expiry, count] of [
      ["pending", "1 day", 23],
      ["pending", "-1 day", 2],
      ["accepted", "-1 day", 2],
      ["revoked", "-1 day", 2],
    ] as const) {
      for (let i = 0; i < count; i++)
        await pool.query(
          "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key,state,expires_at,created_at) VALUES($1,$2,$3,'viewer',$4,$5,$6,now()+$7::interval,'2026-01-02T03:04:05.123456Z')",
          [
            randomUUID(),
            f.org,
            `${state}-${i}-${expiry}@fixture.invalid`,
            f.owner.id,
            randomUUID(),
            state,
            expiry,
          ],
        );
    }
    const page = (query: string, headers = f.owner.headers) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/organizations/${f.org}/staff?${query}`,
        headers,
      });
    for (const [state, count] of [
      ["pending", 23],
      ["expired", 2],
      ["accepted", 2],
      ["revoked", 2],
    ] as const) {
      let cursor: any = null,
        seen: string[] = [];
      do {
        const params = new URLSearchParams({
          invitationState: state,
          ...cursor,
        });
        const r = await page(params.toString());
        assert.equal(r.statusCode, 200, r.body);
        const body = r.json();
        assert.equal(body.members.length, 1);
        assert(body.invitations.every((i: any) => i.state === state));
        seen.push(...body.invitations.map((i: any) => i.id));
        cursor = body.nextCursor;
      } while (cursor);
      assert.equal(seen.length, count);
      assert.equal(new Set(seen).size, count);
    }
    const first = (await page("invitationState=pending")).json();
    const target = first.invitations[0];
    assert.equal(
      (
        await f.app.inject({
          method: "POST",
          url: `/api/v1/organizations/${f.org}/invitations/${target.id}/revoke`,
          headers: f.owner.headers,
          payload: { version: target.version },
        })
      ).statusCode,
      200,
    );
    assert(
      !(await page("invitationState=pending"))
        .json()
        .invitations.some((i: any) => i.id === target.id),
    );
    assert(
      (await page("invitationState=revoked"))
        .json()
        .invitations.some((i: any) => i.id === target.id),
    );
    await pool.query(
      "UPDATE providers.invitations SET expires_at=now()-interval '1 second' WHERE id=$1",
      [first.invitations[1].id],
    );
    assert(
      (await page("invitationState=expired"))
        .json()
        .invitations.some((i: any) => i.id === first.invitations[1].id),
    );
    for (const invalid of [
      "invitationState=unknown",
      "invitationState=",
      "invitationState=pending&afterId=" + target.id,
    ])
      assert.equal((await page(invalid)).statusCode, 422);
    assert.equal(
      (await page("invitationState=accepted", f.stranger.headers)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/provider-invitations?invitationState=accepted",
          headers: f.member.headers,
        })
      ).statusCode,
      422,
    );
  } finally {
    await f.app.close();
  }
});

test("Member role filters paginate independently and reflect authorized role changes", async () => {
  const f = await fixture();
  try {
    for (const [role, count] of [
      ["editor", 23],
      ["viewer", 2],
    ] as const)
      for (let i = 0; i < count; i++) {
        const id = randomUUID();
        await pool.query(
          "INSERT INTO identity.accounts(id,contact) VALUES($1,$2)",
          [id, `${id}@fixture.invalid`],
        );
        await pool.query(
          "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
          [f.org, id, role],
        );
      }
    await f.invite();
    const page = (params: Record<string, string>, headers = f.owner.headers) =>
      f.app.inject({
        method: "GET",
        url: `/api/v1/organizations/${f.org}/staff?${new URLSearchParams(params)}`,
        headers,
      });
    const baseline = (await page({})).json();
    for (const [role, count] of [
      ["owner", 1],
      ["editor", 23],
      ["viewer", 2],
    ] as const) {
      let cursor: any = null,
        seen: string[] = [];
      do {
        const r = await page({ memberRole: role, ...cursor });
        assert.equal(r.statusCode, 200, r.body);
        const body = r.json();
        assert(body.members.every((m: any) => m.role === role));
        assert.deepEqual(body.invitations, baseline.invitations);
        seen.push(...body.members.map((m: any) => m.account_id));
        cursor = body.nextMemberCursor;
      } while (cursor);
      assert.equal(seen.length, count);
      assert.equal(new Set(seen).size, count);
      assert.deepEqual(seen, [...seen].sort());
    }
    const first = (await page({ memberRole: "editor" })).json(),
      target = first.members[0];
    assert.equal(
      (
        await f.app.inject({
          method: "PUT",
          url: `/api/v1/organizations/${f.org}/staff/${target.account_id}`,
          headers: f.owner.headers,
          payload: { version: target.version, role: "viewer" },
        })
      ).statusCode,
      200,
    );
    assert(
      !(await page({ memberRole: "editor" }))
        .json()
        .members.some((m: any) => m.account_id === target.account_id),
    );
    assert(
      (await page({ memberRole: "viewer" }))
        .json()
        .members.some((m: any) => m.account_id === target.account_id),
    );
    const combined = (
      await page({
        memberRole: "editor",
        invitationState: "revoked",
        ...first.nextMemberCursor,
      })
    ).json();
    assert.equal(combined.invitations.length, 0);
    assert.equal(combined.members.length, 3);
    assert.equal((await page({ memberRole: "unknown" })).statusCode, 422);
    assert.equal((await page({ memberRole: "" })).statusCode, 422);
    assert.equal(
      (await page({ memberRole: "owner" }, f.stranger.headers)).statusCode,
      403,
    );
    assert.equal(
      (
        await f.app.inject({
          method: "GET",
          url: "/api/v1/provider-invitations?memberRole=owner",
          headers: f.member.headers,
        })
      ).statusCode,
      422,
    );
    const owner =
      baseline.members.find((m: any) => m.account_id === f.owner.id) ??
      (await page({ memberRole: "owner" })).json().members[0];
    assert.equal(
      (
        await f.app.inject({
          method: "PUT",
          url: `/api/v1/organizations/${f.org}/staff/${owner.account_id}`,
          headers: f.owner.headers,
          payload: { version: owner.version, role: "revoke" },
        })
      ).statusCode,
      403,
    );
  } finally {
    await f.app.close();
  }
});
