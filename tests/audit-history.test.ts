import { auditPage } from "../src/modules/reporting/adapters/audit-schema.ts";
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
async function account(permission = true, mfa = true) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',$3,now())",
    [hashToken(token), id, mfa],
  );
  if (permission)
    await pool.query(
      "INSERT INTO identity.grants VALUES($1,'audit','platform')",
      [id],
    );
  return { id, headers: { cookie: `session=${token}` } };
}
test("Audit HTTP search enforces permission/MFA and provides scoped stable pages without raw details", async () => {
  const app = await buildApp(),
    staff = await account(),
    other = await account(),
    customer = await account(false),
    weak = await account(true, false),
    action = `fixture.audit.${randomUUID()}`,
    target = randomUUID();
  const read = (params: Record<string, string> = {}, who = staff) =>
    app.inject({
      method: "GET",
      url: `/api/v1/admin/audit?${new URLSearchParams(params)}`,
      headers: who.headers,
    });
  try {
    await pool.query(
      `INSERT INTO reporting.audit(actor_id,action,target,details,created_at)
      SELECT $1,$2,$3,jsonb_build_object('secret','never return raw details','outcome',CASE WHEN i=1 THEN 'success' ELSE 'unexpected' END),
      '2026-10-01T00:00:00Z'::timestamptz FROM generate_series(1,55) i`,
      [staff.id, action, target],
    );
    assert.equal(
      (await app.inject({ method: "GET", url: "/api/v1/admin/audit" }))
        .statusCode,
      401,
    );
    for (const who of [customer, weak])
      assert.equal((await read({}, who)).statusCode, 403);
    const filters = {
      actor: staff.id,
      action,
      target,
      from: "2026-10-01T05:30:00+05:30",
      until: "2026-10-02T00:00:00Z",
    };
    const response = await read(filters);
    assert.equal(response.statusCode, 200, response.body);
    assert.ok(!response.body.includes("never return raw details"));
    assert.equal(response.headers["cache-control"], "no-store");
    const first = auditPage.parse(response.json());
    assert.equal(first.items.length, 50);
    assert.ok(first.nextCursor);
    assert.ok(
      first.items.every(
        (i: any) =>
          i.actor_id === staff.id &&
          i.target === target &&
          i.outcome === "not_recorded",
      ),
    );
    await pool.query(
      "INSERT INTO reporting.audit(actor_id,action,target,details,created_at) VALUES($1,$2,$3,'{}','2026-10-01T00:00:00Z')",
      [staff.id, action, target],
    );
    const second = (await read({ ...filters, after: first.nextCursor })).json();
    assert.equal(second.items.length, 5);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.id)).size,
      55,
    );
    assert.equal(
      second.items.filter((i: any) => i.outcome === "success").length,
      1,
    );
    assert.equal(
      (await read({ ...filters, after: first.nextCursor }, other)).statusCode,
      422,
    );
    assert.equal(
      (
        await read({
          ...filters,
          target: randomUUID(),
          after: first.nextCursor,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (await read({ ...filters, until: filters.from })).statusCode,
      422,
    );
    assert.equal((await read({ after: "malformed" })).statusCode, 422);
    assert.equal((await read({ unknown: "value" })).statusCode, 422);
    assert.equal(
      (await read({ ...filters, action: "%" })).json().items.length,
      0,
    );
    assert.equal(
      (await read({ ...filters, from: "2026-10-01T00:00:01Z" })).json().items
        .length,
      0,
    );
    assert.equal(
      (await read({ ...filters, until: "2026-10-01T00:00:00.001Z" })).json()
        .items.length,
      50,
    );
    await pool.query("DELETE FROM identity.grants WHERE account_id=$1", [
      staff.id,
    ]);
    assert.equal(
      (await read({ ...filters, after: first.nextCursor })).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
test("Audit history remains immutable and null actors are preserved", async () => {
  const app = await buildApp(),
    staff = await account(),
    target = randomUUID();
  try {
    const row = await pool.query(
      "INSERT INTO reporting.audit(action,target) VALUES('fixture.system',$1) RETURNING id",
      [target],
    );
    await assert.rejects(
      pool.query("UPDATE reporting.audit SET action='changed' WHERE id=$1", [
        row.rows[0].id,
      ]),
    );
    await assert.rejects(
      pool.query("DELETE FROM reporting.audit WHERE id=$1", [row.rows[0].id]),
    );
    const result = await app.inject({
      method: "GET",
      url: `/api/v1/admin/audit?target=${target}`,
      headers: staff.headers,
    });
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().items[0].actor_id, null);
    assert.equal(result.json().items[0].outcome, "not_recorded");
  } finally {
    await app.close();
  }
});
