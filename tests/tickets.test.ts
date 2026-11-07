import { walletResponse } from "../src/modules/bookings/adapters/wallet-schema.ts";
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

async function prepared(confirmed = true) {
  const f = await fixture();
  const quote = await c.quotes.create(f.owner, f.hold.id);
  const order = (await c.placement.accept(f.owner, randomUUID(), {
    reservationId: f.hold.id,
    quoteId: quote.id,
    acceptPolicies: true,
  })) as any;
  // Trusted-capture input is an isolated application fixture, not provider verification.
  if (confirmed)
    await c.checkout.captured({
      id: "fixture_wallet_" + randomUUID(),
      orderId: order.id,
      amountPaise: order.amount_paise,
      currency: "INR",
    });
  return { ...f, order };
}

// Rasterize the renderer's monochrome SVG path and independently decode the resulting pixels.
async function decodeSvg(svg: string) {
  const { default: jsQR } = await import("jsqr");
  const size = Number(svg.match(/viewBox="0 0 (\d+) /)?.[1]);
  assert.ok(size > 20);
  const d = svg.match(/stroke="#000000" d="([^"]+)"/)?.[1];
  assert.ok(d);
  const scale = 6,
    width = size * scale,
    pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  let x = 0,
    y = 0;
  for (const match of d.matchAll(/([Mmh])([0-9. -]+)/g)) {
    const values = match[2].trim().split(/\s+/).map(Number);
    if (match[1] === "M") {
      x = values[0];
      y = values[1];
    } else if (match[1] === "m") {
      x += values[0];
      y += values[1];
    } else {
      for (
        let py = Math.floor(y) * scale;
        py < (Math.floor(y) + 1) * scale;
        py++
      )
        for (let px = x * scale; px < (x + values[0]) * scale; px++) {
          const i = (py * width + px) * 4;
          pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
        }
      x += values[0];
    }
  }
  const decoded = (
    jsQR as unknown as (
      data: Uint8ClampedArray,
      width: number,
      height: number,
    ) => { data: string } | null
  )(pixels, width, width);
  assert.ok(decoded, "QR must decode independently");
  return decoded.data;
}
test("owner wallet renders independently decodable stable QR credentials without issuing new tickets", async () => {
  const f = await prepared(),
    first = await c.wallet.view(f.owner, f.order.id),
    second = await c.wallet.view(f.owner, f.order.id);
  assert.equal(first.issuance, "issued");
  assert.equal(first.items.length, 3);
  assert.deepEqual(first.items, second.items);
  const raw = await c.tickets.list(f.owner, f.order.id);
  for (const ticket of first.items) {
    assert.ok(ticket.qrSvg);
    assert.equal(
      await decodeSvg(ticket.qrSvg),
      raw.find((r) => r.id === ticket.id)?.token,
    );
    assert.ok(!("token" in ticket));
  }
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM ticketing.tickets WHERE order_id=$1",
        [f.order.id],
      )
    ).rows[0].n,
    3,
  );
  await assert.rejects(c.wallet.view(randomUUID(), f.order.id), {
    code: "NOT_FOUND",
  });
});
test("pending bookings expose no credential or download and incomplete issuance is explicit", async () => {
  const f = await prepared(false);
  assert.equal(
    (await c.wallet.view(f.owner, f.order.id)).issuance,
    "not_confirmed",
  );
  await assert.rejects(c.wallet.document(f.owner, f.order.id), {
    code: "BOOKING_NOT_CONFIRMED",
  });
  await assert.rejects(c.wallet.calendar(f.owner, f.order.id), {
    code: "BOOKING_NOT_CONFIRMED",
  });
  // Isolated incomplete-issuance state fixture; no provider transaction is represented.
  await pool.query("UPDATE bookings.orders SET state='confirmed' WHERE id=$1", [
    f.order.id,
  ]);
  const wallet = await c.wallet.view(f.owner, f.order.id);
  assert.equal(wallet.issuance, "pending");
  assert.equal(wallet.items.length, 0);
});
test("per-ticket revoked, transferred and redeemed states suppress QR display", async () => {
  const f = await prepared(),
    raw = await c.tickets.list(f.owner, f.order.id);
  await pool.query("UPDATE ticketing.tickets SET state='revoked' WHERE id=$1", [
    raw[0].id,
  ]);
  await pool.query(
    "UPDATE ticketing.tickets SET state='replaced' WHERE id=$1",
    [raw[1].id],
  );
  await pool.query("UPDATE ticketing.tickets SET remaining=0 WHERE id=$1", [
    raw[2].id,
  ]);
  const wallet = await c.wallet.view(f.owner, f.order.id);
  assert.deepEqual(
    wallet.items.map((t) => t.status),
    ["revoked", "transferred", "redeemed"],
  );
  assert.ok(wallet.items.every((t) => t.qrSvg === null));
});
test("cancelled and expired occurrences never expose QR credentials; current times flag schedule changes", async () => {
  const f = await prepared();
  await pool.query(
    "UPDATE inventory.occurrences SET state='cancelled' WHERE id=$1",
    [f.occurrence],
  );
  let wallet = await c.wallet.view(f.owner, f.order.id);
  assert.ok(wallet.items.every((t) => t.status === "cancelled" && !t.qrSvg));
  await pool.query(
    "UPDATE inventory.occurrences SET state='open',sales_open=now()-interval '5 days',sales_close=now()-interval '4 days',starts_at=now()-interval '3 days',ends_at=now()-interval '2 days' WHERE id=$1",
    [f.occurrence],
  );
  wallet = await c.wallet.view(f.owner, f.order.id);
  assert.ok(wallet.items.every((t) => t.status === "expired" && !t.qrSvg));
  assert.equal(wallet.occurrences[0].scheduleChanged, true);
});
test("calendar is independently parseable, UTC-correct, folded by bytes and free of ticket credentials", async () => {
  const { default: ICAL } = await import("ical.js"),
    { calendar } = await import("../src/modules/bookings/domain/calendar.ts");
  const venue =
    "सिनेमा ".repeat(30) + ",;\\\r\nBEGIN:VEVENT\r\nSUMMARY:injection";
  const text = calendar(
    [
      {
        id: randomUUID(),
        venueName: venue,
        timeZone: "Asia/Kolkata",
        startsAt: "2027-01-02T00:15:00+05:30",
        endsAt: "2027-01-02T02:15:00+05:30",
        state: "open",
        version: 2,
      },
    ],
    new Date().toISOString(),
  );
  for (const line of text.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const component = new ICAL.Component(ICAL.parse(text)),
    events = component.getAllSubcomponents("vevent");
  assert.equal(events.length, 1);
  const event = new ICAL.Event(events[0]);
  assert.equal(
    event.startDate.toJSDate().toISOString(),
    "2027-01-01T18:45:00.000Z",
  );
  assert.equal(
    events[0].getFirstPropertyValue("location"),
    venue.replace(/\r\n/g, "\n"),
  );
  const f = await prepared(),
    raw = await c.tickets.list(f.owner, f.order.id),
    actual = await c.wallet.calendar(f.owner, f.order.id);
  for (const t of raw) {
    assert.ok(!actual.includes(t.token!));
    assert.ok(!actual.includes(t.id));
  }
  assert.ok(!actual.includes(f.owner));
  assert.equal(
    new ICAL.Component(ICAL.parse(actual)).getAllSubcomponents("vevent").length,
    1,
  );
});
test("printable documents escape supplied text and include only embedded QR images", async () => {
  const { ticketDocument } =
    await import("../src/modules/bookings/adapters/ticket-document.ts");
  const f = await prepared();
  await pool.query(
    "UPDATE inventory.occurrences SET venue_name=$2 WHERE id=$1",
    [f.occurrence, '<script>alert("x")</script>'],
  );
  const html = ticketDocument(await c.wallet.document(f.owner, f.order.id));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.equal(
    (html.match(/src="data:image\/svg\+xml;base64,/g) ?? []).length,
    3,
  );
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("synchronized"));
});
test("authenticated HTTP ticket, document and calendar routes deny cross-account retrieval", async () => {
  const f = await prepared(),
    token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), f.owner],
  );
  const other = await prepared(),
    app = await buildApp();
  try {
    for (const suffix of ["tickets", "tickets/download", "calendar"]) {
      const url = `/api/v1/bookings/${f.order.id}/${suffix}`;
      assert.equal((await app.inject({ url })).statusCode, 401);
      const response = await app.inject({
        url,
        headers: { cookie: `session=${token}` },
      });
      assert.equal(response.statusCode, 200, response.body);
      if (suffix === "tickets") walletResponse.parse(response.json());
      assert.match(String(response.headers["cache-control"]), /no-store/);
      assert.equal(
        (
          await app.inject({
            url: `/api/v1/bookings/${other.order.id}/${suffix}`,
            headers: { cookie: `session=${token}` },
          })
        ).statusCode,
        404,
      );
      if (suffix !== "tickets")
        assert.match(
          String(response.headers["content-disposition"]),
          /^attachment;/,
        );
    }
  } finally {
    await app.close();
  }
});

test("calendar remains available during ticket-key outage and document retry preserves issued identities", async () => {
  const { TicketWallet } =
      await import("../src/modules/bookings/application/wallet.ts"),
    { PostgresBookings } =
      await import("../src/modules/bookings/adapters/postgres.ts"),
    { PostgresTicketOccurrences } =
      await import("../src/modules/inventory/adapters/ticket-occurrences.ts"),
    { PostgresTickets } =
      await import("../src/modules/ticketing/adapters/postgres.ts"),
    { PostgresAdmissionWindow } =
      await import("../src/modules/inventory/adapters/admission.ts"),
    { QrCodes } = await import("../src/modules/ticketing/adapters/qr.ts");
  const f = await prepared(),
    before = await c.wallet.view(f.owner, f.order.id),
    unavailable = new TicketWallet(
      new PostgresBookings(),
      new PostgresTicketOccurrences(),
      new PostgresTickets(new PostgresAdmissionWindow(), ""),
      new QrCodes(),
    );
  await assert.rejects(unavailable.document(f.owner, f.order.id), {
    code: "TICKETING_UNAVAILABLE",
  });
  assert.ok(
    (await unavailable.calendar(f.owner, f.order.id)).includes("BEGIN:VEVENT"),
  );
  assert.deepEqual(
    (await c.wallet.document(f.owner, f.order.id)).items,
    before.items,
  );
});
test("a decoded customer QR works through authorized HTTP admission and redeemed tickets lose their QR", async () => {
  const f = await prepared(),
    wallet = await c.wallet.view(f.owner, f.order.id),
    ticket = wallet.items[0],
    credential = await decodeSvg(ticket.qrSvg!);
  await pool.query(
    "UPDATE inventory.occurrences SET starts_at=now()-interval '1 minute',ends_at=now()+interval '1 hour',sales_close=now()-interval '2 minutes' WHERE id=$1",
    [f.occurrence],
  );
  const token = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
    [hashToken(token), f.owner],
  );
  await pool.query(
    "INSERT INTO identity.grants(account_id,permission,scope) VALUES($1,'admit',$2)",
    [f.owner, `${f.occurrence}:fixture-gate`],
  );
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/scanner/admissions",
      headers: {
        cookie: `session=${token}`,
        origin: "http://localhost:3000",
        "idempotency-key": randomUUID(),
      },
      payload: {
        occurrenceId: f.occurrence,
        gate: "fixture-gate",
        token: credential,
      },
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().outcome, "admitted");
    const after = await c.wallet.view(f.owner, f.order.id);
    assert.equal(
      after.items.find((t) => t.id === ticket.id)?.status,
      "redeemed",
    );
    assert.equal(after.items.find((t) => t.id === ticket.id)?.qrSvg, null);
    assert.equal(after.items.filter((t) => t.qrSvg).length, 2);
  } finally {
    await app.close();
  }
});
