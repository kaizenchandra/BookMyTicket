import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import {
  dashboardPage,
  dashboardRecordsPage,
} from "../src/modules/reporting/adapters/dashboard-schema.ts";
import { dashboardRecordLink } from "../web/features/admin-dashboard.tsx";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account(grants: string[]) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
    [hashToken(token), id],
  );
  for (const grant of grants)
    await pool.query("INSERT INTO identity.grants VALUES($1,$2,'platform')", [
      id,
      grant,
    ]);
  return { id, headers: { cookie: `session=${token}` } };
}
test("FR-02 filters agree across metrics, daily charts and scoped drilldowns; saved snapshots retain history and enforce current permissions", async () => {
  const app = await buildApp(),
    staff = await account([
      "finance",
      "bookings.read",
      "customers.read",
      "support",
    ]),
    finance = await account(["finance"]),
    owner = await account([]),
    owner2 = await account([]);
  const city = `Analytics ${randomUUID()}`,
    org = randomUUID(),
    otherOrg = randomUUID();
  try {
    for (const id of [org, otherOrg])
      await pool.query(
        "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'Analytics fixture','cinema','approved')",
        [id, owner.id],
      );
    const listings = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    for (let i = 0; i < 4; i++)
      await pool.query(
        "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'Analytics fixture',$3,$4,'Fixture','published')",
        [
          listings[i],
          i === 3 ? otherOrg : org,
          i === 1 ? "event" : "movie",
          i === 2 ? "Another city" : city,
        ],
      );
    const make = async (
      listing: string,
      state = "pending_payment",
      confirmed = false,
      amount = 100,
      created = "2076-07-04T00:00:00+05:30",
      customer = owner.id,
    ) => {
      const id = randomUUID(),
        reservation = randomUUID();
      await pool.query(
        "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1,$2,$3,'fixture','active',now()+interval '1 hour')",
        [reservation, customer, reservation],
      );
      await pool.query(
        "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at,confirmed_at) VALUES($1,$2,$3,$4,'INR','fixture',$5,$6,$7,CASE WHEN $8 THEN $7::timestamptz ELSE NULL END)",
        [
          id,
          customer,
          reservation,
          amount,
          state,
          {
            occurrences: [{ listingId: listing, title: "Analytics fixture" }],
            secret: "PRIVATE-SNAPSHOT",
          },
          created,
          confirmed,
        ],
      );
      return id;
    };
    const ids = [];
    for (let i = 0; i < 27; i++)
      ids.push(
        await make(
          listings[0],
          i === 0 ? "confirmed" : i === 1 ? "cancelled" : "pending_payment",
          i < 2,
          i === 1 ? 200 : i === 2 ? 300 : 100,
          undefined,
          i === 26 ? owner2.id : owner.id,
        ),
      );
    const excluded = [];
    for (const listing of listings.slice(1))
      excluded.push(await make(listing, "confirmed", true, 999));
    const old = await make(
      listings[0],
      "confirmed",
      true,
      500,
      "2076-06-30T00:00:00+05:30",
    );
    for (const [id, amount] of [
      [ids[0], 100],
      [old, 500],
      [excluded[0], 999],
    ] as const)
      await pool.query(
        "INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency,captured_at) VALUES($1,$2,$3,'INR','2076-07-04')",
        [randomUUID(), id, amount],
      );
    for (let i = 0; i < 2; i++) {
      await pool.query(
        "INSERT INTO payments.provider_orders(order_id,amount_paise,state,created_at) VALUES($1,100,$2,'2076-07-04')",
        [ids[i], i === 0 ? "unknown" : "ready"],
      );
      await pool.query(
        "INSERT INTO payments.attempts(provider_payment_id,order_id,amount_paise,currency,state,observed_at) VALUES($1,$2,100,'INR',$3,'2076-07-04')",
        [randomUUID(), ids[i], i === 0 ? "refunded" : "failed"],
      );
    }
    await pool.query(
      "INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise,created_at) VALUES($1,$2,$3,'PRIVATE-REASON',100,'2076-07-04')",
      [randomUUID(), ids[0], randomUUID()],
    );
    const caseId = randomUUID();
    await pool.query(
      "INSERT INTO support.cases(id,owner_id,subject,category,state,priority,booking_id,created_at) VALUES($1,$2,'PRIVATE-SUBJECT','booking','escalated','urgent',$3,'2076-07-04')",
      [caseId, owner.id, ids[0]],
    );
    const params = new URLSearchParams({
      year: "2076",
      group: "month",
      index: "7",
      product: "movie",
      city,
      supplier: org,
      currency: "INR",
    });
    const read = (who = staff, extra = "") =>
      app.inject({
        method: "GET",
        url: `/api/v1/admin/dashboard?${params}${extra}`,
        headers: who.headers,
      });
    const response = await read();
    assert.equal(response.statusCode, 200, response.body);
    const report = dashboardPage.parse(response.json());
    assert.equal(report.bookings.bookings, "27");
    assert.equal(report.bookings.gbv, "300");
    assert.equal(report.bookings.active_customers, "2");
    assert.equal(report.bookings.cancelled, "1");
    assert.equal(report.payments.captured_paise, "600");
    assert.equal(report.payments.provider_refunded_attempts, "1");
    assert.equal(report.payments.failed_attempts, "1");
    assert.equal(report.payments.payment_exceptions, "1");
    assert.equal(report.support?.open_cases, "1");
    assert.equal(report.support?.urgent_cases, "1");
    assert.equal(report.grain, "day");
    assert.equal(report.timeseries.length, 31);
    assert.equal(report.timeseries[0].bookings, "0");
    assert.equal(report.timeseries[3].bookings, "27");
    assert.equal(
      report.timeseries.reduce((n, r) => n + BigInt(r.gbv), 0n),
      300n,
    );
    assert.equal(
      report.verticals.find((v) => v.kind === "movie")?.bookings,
      "27",
    );
    assert.equal(
      report.verticals.reduce((n, r) => n + BigInt(r.gbv), 0n),
      300n,
    );
    for (const value of [
      "PRIVATE-SUBJECT",
      "PRIVATE-SNAPSHOT",
      "PRIVATE-REASON",
    ])
      assert.ok(!response.body.includes(value));
    const link = dashboardRecordLink(report, "bookings"),
      recordUrl = "/api/v1" + link;
    const first = await app.inject({
      method: "GET",
      url: recordUrl,
      headers: staff.headers,
    });
    assert.equal(first.statusCode, 200, first.body);
    const page = dashboardRecordsPage.parse(first.json());
    assert.equal(page.items.length, 25);
    assert.ok(page.nextCursor);
    const next = await app.inject({
      method: "GET",
      url: `${recordUrl}&after=${page.nextCursor}`,
      headers: staff.headers,
    });
    assert.equal(next.json().items.length, 2);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: recordUrl,
          headers: finance.headers,
        })
      ).statusCode,
      403,
    );
    const changed = new URL(recordUrl, "http://test");
    changed.searchParams.set("city", "Another city");
    changed.searchParams.set("after", page.nextCursor!);
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: changed.pathname + changed.search,
          headers: staff.headers,
        })
      ).statusCode,
      422,
    );
    const cases = await app.inject({
      method: "GET",
      url: "/api/v1" + dashboardRecordLink(report, "support"),
      headers: staff.headers,
    });
    assert.equal(cases.json().items[0].id, caseId);
    assert.ok(!cases.body.includes("PRIVATE-SUBJECT"));
    const captures = await app.inject({
      method: "GET",
      url: "/api/v1" + dashboardRecordLink(report, "captures"),
      headers: staff.headers,
    });
    assert.equal(
      captures
        .json()
        .items.reduce((n: bigint, r: any) => n + BigInt(r.amount_paise), 0n),
      600n,
    );
    const scoped = dashboardPage.parse(
      (await read(staff, "&state=pending_payment")).json(),
    );
    assert.equal(scoped.bookings.bookings, "25");
    assert.equal(scoped.bookings.gbv, "0");
    assert.equal(scoped.payments.captured_paise, "0");
    assert.equal(scoped.support?.open_cases, "0");
    const emptyParams = new URLSearchParams(params);
    emptyParams.set("supplier", randomUUID());
    const empty = await app.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard?${emptyParams}`,
      headers: staff.headers,
    });
    assert.equal(empty.json().bookings.bookings, "0");
    assert.equal(empty.json().payments.captured_paise, "0");
    assert.equal((await read(finance)).json().support, null);
    await pool.query(
      "UPDATE bookings.orders SET state='cancelled' WHERE id=$1",
      [ids[0]],
    );
    const fresh = dashboardPage.parse((await read()).json());
    assert.equal(fresh.bookings.cancelled, "2");
    const saved = await app.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard/history/${report.snapshotId}`,
      headers: staff.headers,
    });
    assert.equal(saved.statusCode, 200, saved.body);
    assert.equal(saved.json().bookings.cancelled, "1");
    assert.equal(saved.json().historical, true);
    const redacted = await app.inject({
      method: "GET",
      url: `/api/v1/admin/dashboard/history/${report.snapshotId}`,
      headers: finance.headers,
    });
    assert.equal(redacted.json().support, null);
    await assert.rejects(
      pool.query(
        "UPDATE reporting.dashboard_snapshots SET definition_version='tampered' WHERE id=$1",
        [report.snapshotId],
      ),
      /immutable/,
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/admin/dashboard?${params}&unknown=true`,
          headers: staff.headers,
        })
      ).statusCode,
      422,
    );
    const bad = new URLSearchParams(params);
    bad.set("currency", "USD");
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/admin/dashboard?${bad}`,
          headers: staff.headers,
        })
      ).statusCode,
      422,
    );
    await pool.query(
      "DELETE FROM identity.grants WHERE account_id=$1 AND permission='finance'",
      [finance.id],
    );
    assert.equal(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/admin/dashboard/history/${report.snapshotId}`,
          headers: finance.headers,
        })
      ).statusCode,
      403,
    );
  } finally {
    await app.close();
  }
});
