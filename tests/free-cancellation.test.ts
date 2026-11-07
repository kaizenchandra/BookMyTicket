import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import { assignFixturePolicy, fixturePolicy } from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { freeConfirmationResponse } from "../src/modules/bookings/adapters/free-schema.ts";
import { paymentStatusSchema } from "../src/modules/payments/adapters/schemas.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("hex");
before(migrate);
after(() => pool.end());
async function fixture(price = 0, eligible = true, seat = false) {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), owner],
  );
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'FREE FIXTURE','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'FREE FIXTURE','event','Test city','Isolated free booking fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'FREE FIXTURE','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool',$3,'FIXTURE RESOURCE',$4,$2)",
    [occurrence, price, seat ? "seat" : "pool", seat ? 1 : 2],
  );
  await assignFixturePolicy(owner, occurrence, {
    ...fixturePolicy,
    allowFreeBookings: eligible,
    freeCancellationCutoffMinutes: 0,
  });
  const c = commerce(),
    reservations = new Reservations(
      new PostgresReservations(new PostgresCatalog()),
    ),
    hold = (await reservations.reserve(owner, randomUUID(), [
      { occurrenceId: occurrence, resourceId: "pool", quantity: seat ? 1 : 2 },
    ])) as any;
  return {
    owner,
    occurrence,
    hold,
    c,
    headers: { cookie: `session=${token}` },
  };
}
async function prepared(price = 0, seat = false) {
  const f = await fixture(price, true, seat),
    quote = await f.c.quotes.create(f.owner, f.hold.id),
    order = (await f.c.placement.accept(f.owner, randomUUID(), {
      reservationId: f.hold.id,
      quoteId: quote.id,
      acceptPolicies: true,
    })) as any;
  await f.c.freeConfirmation.confirm(f.owner, order.id, randomUUID());
  return { ...f, order };
}
test("previewed confirmed free cancellation revokes tickets, returns capacity and retries without double release", async () => {
  const f = await prepared(),
    app = await buildApp();
  try {
    const preview = await app.inject({
      method: "POST",
      url: `/api/v1/bookings/${f.order.id}/free-cancellation/preview`,
      headers: f.headers,
      payload: {},
    });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().refundPaise, 0);
    assert.equal(preview.json().ticketCount, 2);
    const body = {
        previewId: preview.json().previewId,
        reason: "ISOLATED CUSTOMER CANCELLATION",
        confirm: true,
      },
      key = randomUUID();
    const cancel = (payload = body) =>
      app.inject({
        method: "POST",
        url: `/api/v1/bookings/${f.order.id}/free-cancellation`,
        headers: { ...f.headers, "idempotency-key": key },
        payload,
      });
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => cancel()),
    );
    assert.ok(
      outcomes.every((r) => r.statusCode === 200),
      outcomes.map((r) => r.body).join("\n"),
    );
    assert.equal(
      (await cancel({ ...body, reason: "Changed request reason" })).statusCode,
      409,
    );
    const resource = (
      await pool.query(
        "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
        [f.occurrence],
      )
    ).rows[0];
    assert.equal(resource.sold, 0);
    assert.equal(
      (
        await pool.query(
          "SELECT state FROM inventory.reservations WHERE id=$1",
          [f.hold.id],
        )
      ).rows[0].state,
      "released",
    );
    const tickets = (
      await pool.query(
        "SELECT state FROM ticketing.tickets WHERE order_id=$1",
        [f.order.id],
      )
    ).rows;
    assert.equal(tickets.length, 2);
    assert.ok(tickets.every((t) => t.state === "revoked"));
    const wallet = await app.inject({
      method: "GET",
      url: `/api/v1/bookings/${f.order.id}/tickets`,
      headers: f.headers,
    });
    assert.equal(wallet.statusCode, 200);
    assert.ok(wallet.json().items.every((i: any) => !i.qrSvg));
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM reporting.outbox WHERE aggregate_id=$1 AND type='booking.free_cancelled'",
          [f.order.id],
        )
      ).rows[0].n,
      1,
    );
    const reservations = new Reservations(
      new PostgresReservations(new PostgresCatalog()),
    );
    await reservations.reserve(f.owner, randomUUID(), [
      { occurrenceId: f.occurrence, resourceId: "pool", quantity: 2 },
    ]);
    assert.equal((await cancel()).statusCode, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
          [f.occurrence],
        )
      ).rows[0].sold,
      0,
    );
  } finally {
    await app.close();
  }
});
test("expired preview, policy deadline, owner isolation and changed occurrence reject cancellation", async () => {
  const f = await prepared(),
    p = await f.c.freeCancellation.preview(f.owner, f.order.id),
    input = {
      previewId: p.previewId,
      reason: "ISOLATED EXPIRY TEST",
      confirm: true as const,
    };
  await assert.rejects(f.c.freeCancellation.preview(randomUUID(), f.order.id), {
    code: "NOT_FOUND",
  });
  await pool.query(
    "UPDATE bookings.free_cancel_previews SET expires_at=now()-interval '1 second' WHERE id=$1",
    [p.previewId],
  );
  await assert.rejects(
    f.c.freeCancellation.cancel(f.owner, f.order.id, randomUUID(), input),
    { code: "PREVIEW_EXPIRED" },
  );
  const next = await f.c.freeCancellation.preview(f.owner, f.order.id);
  await pool.query(
    "UPDATE inventory.occurrences SET version=version+1 WHERE id=$1",
    [f.occurrence],
  );
  await assert.rejects(
    f.c.freeCancellation.cancel(f.owner, f.order.id, randomUUID(), {
      ...input,
      previewId: next.previewId,
    }),
    { code: "PREVIEW_EXPIRED" },
  );
  await pool.query(
    "UPDATE inventory.occurrences SET sales_close=now()-interval '2 hours',starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour' WHERE id=$1",
    [f.occurrence],
  );
  await assert.rejects(f.c.freeCancellation.preview(f.owner, f.order.id), {
    code: "CANCELLATION_CLOSED",
  });
  assert.equal(
    (
      await pool.query(
        "SELECT sold FROM inventory.resources WHERE occurrence_id=$1",
        [f.occurrence],
      )
    ).rows[0].sold,
    2,
  );
});
test("gate scan racing cancellation cannot both admit and revoke a ticket", async () => {
  const f = await prepared();
  await pool.query(
    "UPDATE inventory.occurrences SET sales_close=now()+interval '20 minutes',starts_at=now()+interval '30 minutes',ends_at=now()+interval '90 minutes' WHERE id=$1",
    [f.occurrence],
  );
  const p = await f.c.freeCancellation.preview(f.owner, f.order.id),
    ticket = (await f.c.tickets.list(f.owner, f.order.id))[0];
  const outcomes = await Promise.allSettled([
    f.c.freeCancellation.cancel(f.owner, f.order.id, randomUUID(), {
      previewId: p.previewId,
      reason: "ISOLATED SCAN RACE",
      confirm: true,
    }),
    f.c.tickets.admit(
      f.owner,
      f.occurrence,
      "Fixture gate",
      ticket.token!,
      randomUUID(),
    ),
  ]);
  assert.equal(outcomes[1].status, "fulfilled");
  const scan = (outcomes[1] as PromiseFulfilledResult<any>).value.outcome;
  const state = (
    await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [
      f.order.id,
    ])
  ).rows[0].state;
  if (state === "cancelled") {
    assert.equal(scan, "revoked");
    assert.equal(outcomes[0].status, "fulfilled");
  } else {
    assert.equal(state, "confirmed");
    assert.equal(scan, "admitted");
    assert.equal(outcomes[0].status, "rejected");
    await assert.rejects(f.c.freeCancellation.preview(f.owner, f.order.id), {
      code: "TICKETS_NOT_CANCELLABLE",
    });
  }
});

test("cancelled assigned seat can be reserved again without stale cancellation clearing its new owner", async () => {
  const f = await prepared(0, true),
    preview = await f.c.freeCancellation.preview(f.owner, f.order.id),
    key = randomUUID(),
    input = {
      previewId: preview.previewId,
      reason: "ISOLATED SEAT CANCELLATION",
      confirm: true as const,
    };
  await f.c.freeCancellation.cancel(f.owner, f.order.id, key, input);
  const reservations = new Reservations(
      new PostgresReservations(new PostgresCatalog()),
    ),
    replacement = (await reservations.reserve(f.owner, randomUUID(), [
      { occurrenceId: f.occurrence, resourceId: "pool", quantity: 1 },
    ])) as any;
  await f.c.freeCancellation.cancel(f.owner, f.order.id, key, input);
  assert.equal(
    (
      await pool.query(
        "SELECT reservation_id FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id='pool'",
        [f.occurrence],
      )
    ).rows[0].reservation_id,
    replacement.id,
  );
});
