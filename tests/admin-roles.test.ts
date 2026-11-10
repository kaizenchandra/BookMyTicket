import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { AdminRoles } from "../src/modules/identity/application/roles.ts";
import { PostgresRoles } from "../src/modules/identity/adapters/roles.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account(grants: string[] = []) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await session(id, token);
  for (const p of grants)
    await pool.query("INSERT INTO identity.grants VALUES($1,$2,'platform')", [
      id,
      p,
    ]);
  return { id, token, headers: { cookie: `session=${token}` } };
}
async function session(id: string, token = randomBytes(32).toString("hex")) {
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
    [hashToken(token), id],
  );
  return token;
}
async function grants(id: string) {
  return (
    await pool.query(
      "SELECT permission FROM identity.grants WHERE account_id=$1 AND scope='platform' ORDER BY permission",
      [id],
    )
  ).rows.map((r) => r.permission);
}
test("FR-03 roles materialize effective access, preserve direct grants, revoke sessions and reject self changes", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage"]),
    other = await account(["access.manage"]),
    member = await account(["finance"]),
    customer = await account();
  const name = `Role ${randomUUID()}`,
    input = {
      name,
      description: "Test role",
      permissions: ["support", "finance"],
      reason: "Create scoped support role",
    },
    key = randomUUID();
  const request = (
    method: "GET" | "POST" | "PATCH",
    url: string,
    payload?: Record<string, unknown>,
    who = manager,
    requestKey = key,
  ) =>
    app.inject({
      method,
      url,
      payload,
      headers: { ...who.headers, "idempotency-key": requestKey },
    });
  try {
    assert.equal(
      (await request("POST", "/api/v1/admin/roles", input, customer))
        .statusCode,
      403,
    );
    const created = await request("POST", "/api/v1/admin/roles", input);
    assert.equal(created.statusCode, 200, created.body);
    const role = created.json();
    assert.equal(
      (await request("POST", "/api/v1/admin/roles", input)).json().id,
      role.id,
    );
    assert.equal(
      (
        await request("POST", "/api/v1/admin/roles", {
          ...input,
          name: name + " changed",
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/api/v1/admin/roles",
          input,
          manager,
          randomUUID(),
        )
      ).statusCode,
      409,
    );
    const assigned = await request(
      "PATCH",
      `/api/v1/admin/users/${member.id}`,
      {
        expectedVersion: 1,
        roles: [role.id],
        reason: "Assign approved support role",
      },
    );
    assert.equal(assigned.statusCode, 200, assigned.body);
    assert.deepEqual(await grants(member.id), ["finance", "support"]);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [member.id],
        )
      ).rowCount,
      0,
    );
    const memberToken = await session(member.id);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/admin/dashboard?year=2079&group=year",
          headers: { cookie: `session=${memberToken}` },
        })
      ).statusCode,
      200,
    );
    const changed = await request("PATCH", `/api/v1/admin/roles/${role.id}`, {
      ...input,
      expectedVersion: 1,
      active: true,
      permissions: ["bookings.read"],
      reason: "Revise approved role permissions",
    });
    assert.equal(changed.statusCode, 200, changed.body);
    assert.deepEqual(await grants(member.id), ["bookings.read", "finance"]);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [member.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await request("PATCH", `/api/v1/admin/users/${member.id}`, {
          expectedVersion: 2,
          permissions: [],
          reason: "Stale member access submission",
        })
      ).statusCode,
      409,
    );
    const directory = await request(
      "GET",
      `/api/v1/admin/users?role=${role.id}&permission=bookings.read`,
    );
    assert.equal(directory.statusCode, 200, directory.body);
    assert.equal(directory.json().items[0].id, member.id);
    assert.deepEqual(directory.json().items[0].directPermissions, ["finance"]);
    const page = await request(
      "GET",
      "/api/v1/admin/roles?active=true&q=" + encodeURIComponent(name),
    );
    assert.equal(page.statusCode, 200, page.body);
    assert.equal(page.json().items[0].members, "1");
    await session(member.id);
    const deactivated = await request(
      "PATCH",
      `/api/v1/admin/roles/${role.id}`,
      {
        ...input,
        expectedVersion: 2,
        active: false,
        permissions: ["bookings.read"],
        reason: "Deactivate temporary role access",
      },
    );
    assert.equal(deactivated.statusCode, 200, deactivated.body);
    assert.deepEqual(await grants(member.id), ["finance"]);
    const denied = await request(
      "PATCH",
      `/api/v1/admin/users/${customer.id}`,
      {
        expectedVersion: 1,
        roles: [role.id],
        reason: "Attempt inactive role assignment",
      },
    );
    assert.equal(denied.statusCode, 422);
    const selfRole = await request(
      "POST",
      "/api/v1/admin/roles",
      { ...input, name: name + " self", permissions: ["audit"] },
      manager,
      randomUUID(),
    );
    assert.equal(
      (
        await request("PATCH", `/api/v1/admin/users/${manager.id}`, {
          expectedVersion: 1,
          roles: [selfRole.json().id],
          reason: "Self assignment is forbidden",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (
        await request(
          "PATCH",
          `/api/v1/admin/users/${manager.id}`,
          {
            expectedVersion: 1,
            roles: [selfRole.json().id],
            reason: "Second manager assigned role",
          },
          other,
        )
      ).statusCode,
      200,
    );
    manager.token = await session(manager.id);
    manager.headers = { cookie: `session=${manager.token}` };
    assert.equal(
      (
        await request("PATCH", `/api/v1/admin/roles/${selfRole.json().id}`, {
          ...input,
          name: name + " self",
          expectedVersion: 1,
          active: true,
          permissions: ["access.manage"],
          reason: "Indirect self privilege change",
        })
      ).statusCode,
      403,
    );
    const history = await request(
      "GET",
      `/api/v1/admin/users/${member.id}/activity`,
    );
    assert.equal(history.statusCode, 200, history.body);
    assert.ok(
      history
        .json()
        .items.some((r: any) => r.action === "identity.role.changed"),
    );
    assert.ok(!history.body.includes("@fixture.invalid"));
    const oldVersion = (
      await pool.query("SELECT version FROM identity.admin_roles WHERE id=$1", [
        role.id,
      ])
    ).rows[0].version;
    const service = new AdminRoles(new PostgresRoles(), {
      record: async () => {
        throw Error("audit offline");
      },
    });
    await assert.rejects(
      service.update(manager.id, role.id, {
        ...input,
        active: true,
        expectedVersion: oldVersion,
        permissions: ["support"],
      }),
      /audit offline/,
    );
    assert.equal(
      (
        await pool.query(
          "SELECT version FROM identity.admin_roles WHERE id=$1",
          [role.id],
        )
      ).rows[0].version,
      oldVersion,
    );
    assert.deepEqual(await grants(member.id), ["finance"]);
  } finally {
    await app.close();
  }
});
test("FR-03 administrator creation is idempotent and requires normal verified-contact login and MFA", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage"]),
    contact = `admin-${randomUUID()}@fixture.invalid`,
    body = {
      contact,
      name: "Created administrator",
      roles: [],
      permissions: ["bookings.read"],
      reason: "Provision approved administrator",
    },
    key = randomUUID();
  const create = (payload = body, k = key) =>
    app.inject({
      method: "POST",
      url: "/api/v1/admin/users",
      headers: { ...manager.headers, "idempotency-key": k },
      payload,
    });
  try {
    const a = await create();
    assert.equal(a.statusCode, 200, a.body);
    assert.equal((await create()).json().id, a.json().id);
    assert.equal((await create(body, randomUUID())).statusCode, 409);
    const id = a.json().id;
    assert.deepEqual(await grants(id), ["bookings.read"]);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [id],
        )
      ).rowCount,
      0,
    );
    const token = await session(id);
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=false WHERE account_id=$1",
      [id],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/admin/bookings",
          headers: { cookie: `session=${token}` },
        })
      ).statusCode,
      403,
    );
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/admin/users?q=Created%20administrator&permission=bookings.read",
      headers: manager.headers,
    });
    assert.equal(list.statusCode, 200, list.body);
    assert.ok(list.json().items.some((r: any) => r.id === id));
    assert.ok(!list.body.includes(contact));
    const suspend = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/users/${id}`,
      headers: manager.headers,
      payload: {
        expectedVersion: 1,
        status: "suspended",
        reason: "Suspend pending security review",
      },
    });
    assert.equal(suspend.statusCode, 200, suspend.body);
    assert.equal(
      (
        await pool.query(
          "SELECT * FROM identity.sessions WHERE account_id=$1",
          [id],
        )
      ).rowCount,
      0,
    );
  } finally {
    await app.close();
  }
});

test("FR-03 role pagination and filters bind cursors to actor and selection", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage"]),
    other = await account(["access.manage"]),
    prefix = `Page ${randomUUID()}`;
  try {
    for (let i = 0; i < 27; i++)
      await pool.query(
        "INSERT INTO identity.admin_roles(id,name,created_at) VALUES($1,$2,'2078-01-01')",
        [randomUUID(), `${prefix} ${i}`],
      );
    const url = "/api/v1/admin/roles?q=" + encodeURIComponent(prefix);
    const first = await app.inject({
      method: "GET",
      url,
      headers: manager.headers,
    });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(first.json().items.length, 25);
    const nextUrl = url + "&after=" + first.json().nextCursor,
      next = await app.inject({
        method: "GET",
        url: nextUrl,
        headers: manager.headers,
      });
    assert.equal(next.json().items.length, 2);
    assert.equal(
      new Set([...first.json().items, ...next.json().items].map((r) => r.id))
        .size,
      27,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: nextUrl,
          headers: other.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: nextUrl + "&active=false",
          headers: manager.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/admin/roles",
          headers: manager.headers,
        })
      ).headers["cache-control"],
      "no-store",
    );
  } finally {
    await app.close();
  }
});

test("FR-03 rejects mixed-case self changes and returns masked, audited account access details", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage"]),
    target = await account(["finance"]),
    customer = await account();
  try {
    const denied = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/users/${manager.id.toUpperCase()}`,
      headers: manager.headers,
      payload: {
        expectedVersion: 1,
        permissions: ["access.manage", "audit"],
        reason: "Attempt mixed-case self change",
      },
    });
    assert.equal(denied.statusCode, 403, denied.body);
    assert.deepEqual(await grants(manager.id), ["access.manage"]);
    const roleId = randomUUID();
    await pool.query(
      "INSERT INTO identity.admin_roles(id,name) VALUES($1,$2)",
      [roleId, `Detail ${randomUUID()}`],
    );
    await pool.query(
      "INSERT INTO identity.admin_role_permissions VALUES($1,'bookings.read')",
      [roleId],
    );
    assert.equal(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/v1/admin/users/${target.id}`,
          headers: manager.headers,
          payload: {
            expectedVersion: 1,
            roles: [roleId],
            reason: "Assign role for detail verification",
          },
        })
      ).statusCode,
      200,
    );
    const url = `/api/v1/admin/users/${target.id.toUpperCase()}`,
      read = await app.inject({ method: "GET", url, headers: manager.headers });
    assert.equal(read.statusCode, 200, read.body);
    assert.equal(read.headers["cache-control"], "no-store");
    assert.ok(!read.body.includes(`${target.id}@fixture.invalid`));
    assert.deepEqual(read.json().directPermissions, ["finance"]);
    assert.deepEqual(read.json().permissions, ["bookings.read", "finance"]);
    assert.equal(read.json().roleDefinitions[0].id, roleId);
    assert.equal(read.json().roleDefinitions[0].active, true);
    assert.equal(
      (await app.inject({ method: "GET", url, headers: customer.headers }))
        .statusCode,
      403,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/admin/users/${randomUUID()}`,
          headers: manager.headers,
        })
      ).statusCode,
      404,
    );
    const history = await app.inject({
      method: "GET",
      url: `/api/v1/admin/users/${target.id.toUpperCase()}/activity`,
      headers: manager.headers,
    });
    assert.equal(history.statusCode, 200, history.body);
    assert.ok(
      history
        .json()
        .items.some((r: any) => r.action === "identity.admin.changed"),
    );
  } finally {
    await app.close();
  }
});

test("FR-03 newest and oldest pages have stable, filter-preserving account and role order", async () => {
  const app = await buildApp(),
    manager = await account(["access.manage"]),
    prefix = `Sort ${randomUUID()}`,
    ids: string[] = [];
  try {
    for (let i = 0; i < 27; i++) {
      const id = randomUUID();
      ids.push(id);
      await pool.query(
        "INSERT INTO identity.accounts(id,contact,admin_name,is_admin,created_at) VALUES($1,$2,$3,true,'2079-01-01')",
        [id, `${id}@fixture.invalid`, prefix],
      );
      await pool.query(
        "INSERT INTO identity.admin_roles(id,name,created_at) VALUES($1,$2,'2079-01-01')",
        [id, `${prefix} ${i}`],
      );
    }
    for (const resource of ["users", "roles"]) {
      const base = `/api/v1/admin/${resource}?q=${encodeURIComponent(prefix)}`;
      for (const sort of ["newest", "oldest"]) {
        const url = base + "&sort=" + sort,
          first = await app.inject({
            method: "GET",
            url,
            headers: manager.headers,
          });
        assert.equal(first.statusCode, 200, first.body);
        assert.equal(first.json().items.length, 25);
        const next = await app.inject({
          method: "GET",
          url: url + "&after=" + first.json().nextCursor,
          headers: manager.headers,
        });
        assert.equal(next.statusCode, 200, next.body);
        const ordered = [...first.json().items, ...next.json().items].map(
          (r) => r.id,
        );
        assert.deepEqual(
          ordered,
          ids
            .slice()
            .sort((a, b) =>
              sort === "oldest" ? a.localeCompare(b) : b.localeCompare(a),
            ),
        );
        const other = sort === "newest" ? "oldest" : "newest";
        assert.equal(
          (
            await app.inject({
              method: "GET",
              url:
                base + "&sort=" + other + "&after=" + first.json().nextCursor,
              headers: manager.headers,
            })
          ).statusCode,
          422,
        );
      }
    }
  } finally {
    await app.close();
  }
});

test("Admin page links retain filters and permission explanations exclude inactive roles", async () => {
  const { adminPageLink, permissionSources } =
    await import("../web/features/admin-access-links.ts");
  assert.equal(
    adminPageLink(
      "/admin/users",
      "?q=Support+team&sort=oldest&role=example&after=old",
    ),
    "/admin/users?q=Support+team&sort=oldest&role=example",
  );
  assert.equal(
    adminPageLink(
      "/admin/roles",
      "?active=false&sort=oldest&after=old",
      "next",
    ),
    "/admin/roles?active=false&sort=oldest&after=next",
  );
  assert.deepEqual(
    permissionSources(
      "finance",
      ["finance"],
      [
        { name: "Finance", active: true, permissions: ["finance"] },
        { name: "Disabled", active: false, permissions: ["finance"] },
      ],
    ),
    ["Direct grant", "Role: Finance"],
  );
});
