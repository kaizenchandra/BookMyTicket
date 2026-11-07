import { quoteResponseSchema } from "../src/modules/pricing/adapters/schemas.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import {
  assignFixturePolicy,
  fixturePolicy,
  policies,
} from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.EXPORT_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const c = commerce(),
  reservations = new Reservations(
    new PostgresReservations(new PostgresCatalog()),
  );
async function fixture(approvedPolicy = true) {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'PRICING TEST ONLY','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'PRICING TEST ONLY','event','Test city','Isolated fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'Pricing fixture venue','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool','pool','TEST POOL',20,101)",
    [occurrence],
  );
  const policyId = approvedPolicy
    ? await assignFixturePolicy(owner, occurrence, {
        ...fixturePolicy,
        feePerOrderPaise: 5,
        ticketTax: { basisPoints: 500, mode: "exclusive" },
      })
    : null;
  const hold = (await reservations.reserve(owner, randomUUID(), [
    { occurrenceId: occurrence, resourceId: "pool", quantity: 3 },
  ])) as any;
  return { owner, org, listing, occurrence, policyId, hold };
}

const definition = {
  title: "Export test form",
  instructions: "Isolated fixture only",
  fields: [
    {
      id: "name",
      label: "Name",
      purpose: "Attendee admission",
      type: "text" as const,
      required: true,
      maxLength: 100,
      options: [],
    },
    {
      id: "private",
      label: "Private detail",
      purpose: "Not selected for export",
      type: "text" as const,
      required: false,
      maxLength: 100,
      options: [],
    },
  ],
};
async function prepared(confirmed = true) {
  const f = await fixture();
  await pool.query(
    "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
    [f.org, f.owner],
  );
  const form = await c.forms.publish(f.owner, f.occurrence, 0, definition);
  const quote = await c.quotes.create(f.owner, f.hold.id);
  const order = (await c.placement.accept(f.owner, randomUUID(), {
    reservationId: f.hold.id,
    quoteId: quote.id,
    acceptPolicies: true,
    registration: {
      formId: form.id,
      answers: [
        { name: "=HYPERLINK(unsafe)", private: "unselected secret" },
        { name: 'Comma, and "quote"' },
        { name: "Third" },
      ],
    },
  })) as any;
  // Isolated captured-input fixture, not evidence of a provider transaction.
  if (confirmed)
    await c.checkout.captured({
      id: "fixture_export_" + randomUUID(),
      orderId: order.id,
      amountPaise: order.amount_paise,
      currency: "INR",
    });
  return {
    ...f,
    form,
    order,
    input: {
      occurrenceId: f.occurrence,
      formId: form.id,
      fields: ["name"],
      purpose: "Test admission roster export",
      confirmScope: true,
    },
  };
}
async function job(f: Awaited<ReturnType<typeof prepared>>) {
  return (await c.attendeeExports.request(
    f.owner,
    randomUUID(),
    f.input,
  )) as any;
}
async function state(id: string) {
  return (
    await pool.query("SELECT * FROM reporting.attendee_exports WHERE id=$1", [
      id,
    ])
  ).rows[0];
}
async function processJob(id: string) {
  const attempts = (await state(id)).attempts;
  for (let i = 0; i < 100; i++) {
    await c.attendeeExports.once();
    if ((await state(id)).attempts > attempts) return;
  }
  throw new Error("Target export was not processed");
}
test("export validates scope, deduplicates requests, minimizes fields and produces encrypted safe CSV", async () => {
  const f = await prepared(),
    key = randomUUID(),
    j = (await c.attendeeExports.request(f.owner, key, f.input)) as any;
  assert.equal(
    ((await c.attendeeExports.request(f.owner, key, f.input)) as any).id,
    j.id,
  );
  await assert.rejects(
    c.attendeeExports.request(f.owner, key, {
      ...f.input,
      purpose: "Changed export purpose",
    }),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  await assert.rejects(
    c.attendeeExports.request(f.owner, randomUUID(), {
      ...f.input,
      fields: ["unknown"],
    }),
    { code: "INVALID_EXPORT_FIELD" },
  );
  await assert.rejects(
    c.attendeeExports.request(f.owner, randomUUID(), {
      ...f.input,
      confirmScope: false,
    }),
    { code: "INVALID_EXPORT" },
  );
  await Promise.all([c.attendeeExports.once(), c.attendeeExports.once()]);
  if ((await state(j.id)).attempts === 0) await processJob(j.id);
  const row = await state(j.id);
  assert.equal(row.state, "ready");
  assert.equal(row.attempts, 1);
  assert.equal(row.row_count, 3);
  assert.ok(!row.artifact.includes("HYPERLINK"));
  assert.ok(!JSON.stringify(row).includes("unselected secret"));
  const csv = await c.attendeeExports.download(f.owner, j.id);
  assert.ok(csv.includes(`"'=HYPERLINK(unsafe)"`));
  assert.ok(csv.includes('"Comma, and ""quote"""'));
  assert.ok(!csv.includes("unselected secret"));
  assert.ok(!csv.includes(f.owner));
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM reporting.audit WHERE action='attendee_export.downloaded' AND target=$1",
        [j.id],
      )
    ).rowCount,
    1,
  );
});
test("exports exclude pending orders and require current owner role at request, execution and download", async () => {
  const f = await prepared(false),
    j = await job(f);
  await processJob(j.id);
  assert.equal((await state(j.id)).row_count, 0);
  await pool.query(
    "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
    [f.org, f.owner],
  );
  await assert.rejects(c.attendeeExports.download(f.owner, j.id), {
    code: "FORBIDDEN",
  });
  await assert.rejects(c.attendeeExports.list(f.owner, f.occurrence), {
    code: "FORBIDDEN",
  });
  await assert.rejects(job(f), { code: "FORBIDDEN" });
  await pool.query(
    "UPDATE providers.memberships SET role='owner' WHERE organization_id=$1 AND account_id=$2",
    [f.org, f.owner],
  );
  const queued = await job(f);
  await pool.query(
    "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
    [f.org, f.owner],
  );
  await processJob(queued.id);
  assert.equal((await state(queued.id)).state, "failed");
  assert.equal((await state(queued.id)).artifact, null);
  const other = await prepared();
  await assert.rejects(c.attendeeExports.download(other.owner, j.id), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    c.attendeeExports.request(other.owner, randomUUID(), f.input),
    { code: "FORBIDDEN" },
  );
});
test("suspension and expiry deny download immediately; cleanup removes encrypted artifact", async () => {
  const f = await prepared(),
    j = await job(f);
  await processJob(j.id);
  await pool.query(
    "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
    [f.owner],
  );
  await assert.rejects(c.attendeeExports.download(f.owner, j.id), {
    code: "FORBIDDEN",
  });
  await pool.query("UPDATE identity.accounts SET status='active' WHERE id=$1", [
    f.owner,
  ]);
  await pool.query(
    "UPDATE reporting.attendee_exports SET expires_at=now()-interval '1 second' WHERE id=$1",
    [j.id],
  );
  await assert.rejects(c.attendeeExports.download(f.owner, j.id), {
    code: "EXPORT_EXPIRED",
  });
  await c.attendeeExports.once();
  assert.equal((await state(j.id)).artifact, null);
  assert.equal((await state(j.id)).state, "expired");
});
test("configuration failure persists a retry and recovers without plaintext or duplicate artifacts", async () => {
  const f = await prepared(),
    j = await job(f),
    key = process.env.EXPORT_ENCRYPTION_KEY;
  delete process.env.EXPORT_ENCRYPTION_KEY;
  try {
    await processJob(j.id);
  } finally {
    process.env.EXPORT_ENCRYPTION_KEY = key;
  }
  assert.equal((await state(j.id)).state, "queued");
  assert.equal((await state(j.id)).error_code, "EXPORT_UNAVAILABLE");
  assert.equal((await state(j.id)).artifact, null);
  await pool.query(
    "UPDATE reporting.attendee_exports SET next_attempt_at=now() WHERE id=$1",
    [j.id],
  );
  await processJob(j.id);
  assert.equal((await state(j.id)).state, "ready");
  assert.equal((await state(j.id)).attempts, 2);
});
test("HTTP export requires recent MFA and protects private download headers", async () => {
  const f = await prepared(),
    token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), f.owner],
  );
  const app = await buildApp();
  try {
    const headers = {
      cookie: `session=${token}`,
      origin: "http://localhost:3000",
      "idempotency-key": randomUUID(),
    };
    const unverified = await app.inject({
      method: "POST",
      url: "/api/v1/attendee-exports",
      headers,
      payload: f.input,
    });
    assert.equal(unverified.statusCode, 403);
    assert.equal(unverified.json().code, "MFA_REQUIRED");
    await pool.query(
      "UPDATE identity.sessions SET mfa_verified=true,mfa_verified_at=clock_timestamp() WHERE token_hash=$1",
      [hashToken(token)],
    );
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/attendee-exports",
      headers,
      payload: f.input,
    });
    assert.equal(created.statusCode, 200, created.body);
    await processJob(created.json().id);
    const download = await app.inject({
      method: "GET",
      url: `/api/v1/attendee-exports/${created.json().id}/download`,
      headers,
    });
    assert.equal(download.statusCode, 200, download.body);
    assert.equal(download.headers["cache-control"], "private, no-store");
    assert.match(
      String(download.headers["content-disposition"]),
      /^attachment;/,
    );
    assert.match(String(download.headers["content-type"]), /^text\/csv/);
  } finally {
    await app.close();
  }
});
test("CSV cells neutralize formula and control prefixes and preserve quoting", async () => {
  const { csvCell } = await import("../src/modules/reporting/domain/csv.ts");
  for (const s of ["=1+1", "  +1", "-2", "@SUM(A1)", "\tunsafe", "\runsafe"])
    assert.ok(csvCell(s).startsWith(`"'`));
  assert.equal(csvCell('a,b"c'), '"a,b""c"');
});

test("permission revocation committed while generation waits prevents artifact creation", async () => {
  const f = await prepared(),
    j = await job(f),
    revocation = await pool.connect();
  let work: Promise<void> | undefined;
  try {
    await revocation.query("BEGIN");
    const pid = (await revocation.query("SELECT pg_backend_pid() AS pid"))
      .rows[0].pid;
    await revocation.query(
      "UPDATE providers.memberships SET role='viewer' WHERE organization_id=$1 AND account_id=$2",
      [f.org, f.owner],
    );
    work = processJob(j.id);
    let blocked = false;
    for (let i = 0; i < 100; i++) {
      const r = await pool.query(
        "SELECT count(*)::int AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))",
        [pid],
      );
      if (r.rows[0].n > 0) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(
      blocked,
      "export worker must encounter the in-flight permission change",
    );
    await revocation.query("COMMIT");
    await work;
    assert.equal((await state(j.id)).state, "failed");
    assert.equal((await state(j.id)).error_code, "FORBIDDEN");
    assert.equal((await state(j.id)).artifact, null);
  } finally {
    await revocation.query("ROLLBACK");
    revocation.release();
    if (work) await work;
  }
});
test("exhausted retries become terminal and ciphertext cannot be copied between jobs", async () => {
  const f = await prepared(),
    j = await job(f),
    key = process.env.EXPORT_ENCRYPTION_KEY;
  delete process.env.EXPORT_ENCRYPTION_KEY;
  try {
    for (let i = 0; i < 3; i++) {
      await pool.query(
        "UPDATE reporting.attendee_exports SET next_attempt_at=now() WHERE id=$1",
        [j.id],
      );
      await processJob(j.id);
    }
  } finally {
    process.env.EXPORT_ENCRYPTION_KEY = key;
  }
  assert.equal((await state(j.id)).state, "failed");
  assert.equal((await state(j.id)).attempts, 3);
  await c.attendeeExports.once();
  assert.equal((await state(j.id)).attempts, 3);
  const a = await job(f),
    b = await job(f);
  await processJob(a.id);
  await processJob(b.id);
  await pool.query(
    "UPDATE reporting.attendee_exports SET artifact=$2 WHERE id=$1",
    [b.id, (await state(a.id)).artifact],
  );
  await assert.rejects(c.attendeeExports.download(f.owner, b.id));
});
