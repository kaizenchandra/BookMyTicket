import { CustomerCaseFiltersForm } from "../web/features/customer-case-filters.tsx";
import { customerCasePage } from "../src/modules/support/adapters/schemas.ts";
import { customerCaseLink } from "../web/features/support-context.ts";
import { PostgresCollection } from "../src/modules/payments/adapters/collection.ts";
import { paymentHistoryPage } from "../src/modules/bookings/adapters/payment-history-schema.ts";
import {
  PaymentHistoryEntries,
  PaymentHistoryPanel,
} from "../web/features/payment-history.tsx";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { bookingTimelinePage } from "../src/modules/bookings/adapters/timeline-schema.ts";
import {
  BookingMilestones,
  BookingTimelinePanel,
} from "../web/features/booking-timeline.tsx";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test database");
before(migrate);
after(() => pool.end());
async function account() {
  const id = randomUUID(),
    token = randomBytes(24).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",
    [hashToken(token), id],
  );
  return { id, headers: { cookie: `session=${token}` } };
}
async function order(owner: string, accepted = true) {
  const id = randomUUID(),
    reservation = randomUUID();
  await pool.query(
    "INSERT INTO inventory.reservations(id,owner_id,idempotency_key,fingerprint,state,expires_at) VALUES($1::uuid,$2,$1::text,'fixture','consumed',now())",
    [reservation, owner],
  );
  await pool.query(
    "INSERT INTO bookings.orders(id,owner_id,reservation_id,amount_paise,currency,policy_version,state,snapshot,created_at,accepted_at) VALUES($1,$2,$3,0,'INR','fixture','pending_payment',$4,'2026-01-01T00:00:00.123456Z',$5)",
    [
      id,
      owner,
      reservation,
      { private: "DO_NOT_RETURN" },
      accepted ? "2026-01-01T00:00:00.123456Z" : null,
    ],
  );
  return id;
}
test("Booking timeline uses recorded milestones with exact ordering and separate current state", async () => {
  const app = await buildApp(),
    owner = await account(),
    id = await order(owner.id);
  const read = async () => {
    const response = await app.inject({
      url: `/api/v1/bookings/${id}/timeline`,
      headers: owner.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store");
    assert(!response.body.includes("DO_NOT_RETURN"));
    return bookingTimelinePage.parse(response.json());
  };
  try {
    const pending = await read();
    assert.equal(pending.currentState, "pending_payment");
    assert.deepEqual(
      pending.items.map((i) => i.kind),
      ["created", "policies_accepted"],
    );
    assert.equal(pending.items[0].occurredAt, "2026-01-01T00:00:00.123456Z");
    await pool.query(
      "UPDATE bookings.orders SET state='confirmed',confirmed_at='2026-01-01T00:00:00.123457Z',confirmed_payment_id='PRIVATE_PROVIDER_REF_' || id::text WHERE id=$1",
      [id],
    );
    const confirmed = await read();
    assert.equal(confirmed.currentState, "confirmed");
    assert.equal(confirmed.items[2].kind, "confirmed");
    assert.equal(confirmed.items[2].occurredAt, "2026-01-01T00:00:00.123457Z");
    await pool.query(
      "INSERT INTO bookings.free_cancellations(order_id,owner_id,reason,created_at) VALUES($1,$2,'PRIVATE_CANCELLATION_REASON','2026-01-02T00:00:00Z')",
      [id, owner.id],
    );
    await pool.query(
      "UPDATE bookings.orders SET state='cancelled' WHERE id=$1",
      [id],
    );
    const cancelled = await read();
    assert.equal(cancelled.currentState, "cancelled");
    assert.deepEqual(
      cancelled.items.map((i) => i.kind),
      ["created", "policies_accepted", "confirmed", "free_cancelled"],
    );
    assert(!JSON.stringify(cancelled).includes("PRIVATE_"));
  } finally {
    await app.close();
  }
});
test("Booking timelines protect ownership and do not invent missing cancellation or recovery dates", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    id = await order(owner.id, false),
    url = `/api/v1/bookings/${id}/timeline`;
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal(
      (await app.inject({ url, headers: other.headers })).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/v1/bookings/${randomUUID()}/timeline`,
          headers: owner.headers,
        })
      ).statusCode,
      404,
    );
    assert.equal(
      (
        await app.inject({
          url: "/api/v1/bookings/invalid/timeline",
          headers: owner.headers,
        })
      ).statusCode,
      422,
    );
    assert.equal(
      (
        await app.inject({
          url: url + "?ownerId=" + owner.id,
          headers: owner.headers,
        })
      ).statusCode,
      422,
    );
    for (const state of ["refund_required", "cancelled"]) {
      await pool.query("UPDATE bookings.orders SET state=$2 WHERE id=$1", [
        id,
        state,
      ]);
      const page = bookingTimelinePage.parse(
        (await app.inject({ url, headers: owner.headers })).json(),
      );
      assert.equal(page.currentState, state);
      assert.deepEqual(
        page.items.map((i) => i.kind),
        ["created"],
      );
    }
    await pool.query(
      "INSERT INTO bookings.pending_cancellations(order_id,owner_id,reason) VALUES($1,$2,'Private reason')",
      [id, owner.id],
    );
    const page = bookingTimelinePage.parse(
      (await app.inject({ url, headers: owner.headers })).json(),
    );
    assert.deepEqual(
      page.items.map((i) => i.kind),
      ["created", "pending_cancelled"],
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [owner.id],
    );
    assert.equal(
      (await app.inject({ url, headers: owner.headers })).statusCode,
      401,
    );
  } finally {
    await app.close();
  }
});
test("Booking timeline labels order creation separately from confirmation and renders recorded times", () => {
  const html = renderToStaticMarkup(
    createElement(BookingMilestones, {
      items: [
        { kind: "created", occurredAt: "2026-01-01T00:00:00.000Z" },
        { kind: "pending_cancelled", occurredAt: "2026-01-02T00:00:00.000Z" },
      ],
    }),
  );
  assert(html.includes("Booking order created"));
  assert(html.includes("Pending order cancelled"));
  assert(!html.includes("Booking confirmed"));
  assert(html.includes("India time"));
  assert(html.includes('dateTime="2026-01-01T00:00:00.000Z"'));
  const panel = renderToStaticMarkup(
    createElement(BookingTimelinePanel, { id: randomUUID(), revision: 0 }),
  );
  assert(panel.includes("Loading timeline"));
  assert(panel.includes("Creating an order does not confirm it"));
  assert(panel.includes("not included here"));
});

test("Payment history is owner scoped, paginates exact recorded events and redacts provider data", async () => {
  const app = await buildApp(),
    owner = await account(),
    stranger = await account(),
    id = await order(owner.id),
    empty = await order(owner.id),
    url = `/api/v1/bookings/${id}/payment-history`;
  const get = (suffix = "", headers = owner.headers) =>
    app.inject({ url: url + suffix, headers });
  try {
    assert.equal((await app.inject({ url })).statusCode, 401);
    assert.equal((await get("", stranger.headers)).statusCode, 404);
    assert.deepEqual(paymentHistoryPage.parse((await get()).json()), {
      items: [],
      nextCursor: null,
    });
    for (let i = 0; i < 25; i++) {
      if (i % 2 === 0)
        await pool.query(
          "INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency,captured_at) VALUES($1,$2,12345,'INR',$3)",
          [
            `PRIVATE_CAPTURE_${randomUUID()}`,
            id,
            i === 0
              ? "2026-01-02T00:00:00.123457Z"
              : "2026-01-02T00:00:00.123456Z",
          ],
        );
      else
        await pool.query(
          "INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise,created_at) VALUES($1,$2,$3,'PRIVATE_REASON',12345,'2026-01-02T00:00:00.123456Z')",
          [randomUUID(), id, `PRIVATE_RECOVERY_${randomUUID()}`],
        );
    }
    await pool.query(
      "UPDATE bookings.orders SET state='cancelled' WHERE id=$1",
      [id],
    );
    const response = await get(),
      first = paymentHistoryPage.parse(response.json());
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(first.items.length, 20);
    assert.equal(first.items[0].occurredAt, "2026-01-02T00:00:00.123457Z");
    assert.equal(first.items[0].kind, "capture_recorded");
    assert(
      first.items.every((i) => i.amountPaise === 12345 && i.currency === "INR"),
    );
    assert(first.nextCursor);
    assert(!response.body.includes("PRIVATE_"));
    assert(
      !Buffer.from(first.nextCursor!, "base64url")
        .toString()
        .includes("PRIVATE_"),
    );
    assert.deepEqual(
      paymentHistoryPage.parse((await get()).json()).items,
      first.items,
    );
    await pool.query(
      "INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency,captured_at) VALUES($1,$2,100,'INR','2026-01-03T00:00:00Z')",
      [`PRIVATE_NEW_${randomUUID()}`, id],
    );
    const second = paymentHistoryPage.parse(
      (await get("?after=" + encodeURIComponent(first.nextCursor!))).json(),
    );
    assert.equal(second.items.length, 5);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.kind + ":" + i.id))
        .size,
      25,
    );
    assert.equal(
      (
        await app.inject({
          url: `/api/v1/bookings/${empty}/payment-history?after=${first.nextCursor}`,
          headers: owner.headers,
        })
      ).statusCode,
      422,
    );
    for (const query of ["after=invalid", "after=", "limit=1000"])
      assert.equal((await get("?" + query)).statusCode, 422);
    assert.equal(
      (await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [id]))
        .rows[0].state,
      "cancelled",
    );
    assert.deepEqual(
      paymentHistoryPage.parse(
        (
          await app.inject({
            url: `/api/v1/bookings/${empty}/payment-history`,
            headers: owner.headers,
          })
        ).json(),
      ),
      { items: [], nextCursor: null },
    );
    await pool.query(
      "UPDATE identity.accounts SET status='suspended' WHERE id=$1",
      [owner.id],
    );
    assert.equal((await get()).statusCode, 401);
  } finally {
    await app.close();
  }
});
test("Payment record presentation distinguishes capture and recovery from booking and refund completion", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentHistoryEntries, {
      items: [
        {
          id: randomUUID(),
          kind: "capture_recorded",
          occurredAt: "2026-01-01T00:00:00.000Z",
          amountPaise: 10000,
          currency: "INR",
        },
        {
          id: randomUUID(),
          kind: "recovery_recorded",
          occurredAt: "2026-01-01T01:00:00.000Z",
          amountPaise: 10000,
          currency: "INR",
        },
      ],
    }),
  );
  assert(html.includes("Payment capture recorded"));
  assert(html.includes("Payment recovery recorded"));
  assert(!html.includes("Refund completed"));
  assert(html.includes("India time"));
  const initial = renderToStaticMarkup(
    createElement(PaymentHistoryPanel, { id: randomUUID(), revision: 0 }),
  );
  assert(initial.includes("does not guarantee booking confirmation"));
  assert(initial.includes("does not confirm a refund"));
  assert(initial.includes("Loading payment history"));
  assert(initial.includes("Payment record type"));
  assert(initial.includes("Apply payment filters"));
  assert(initial.includes("Clear payment filters"));
});

test("Payment attempt history records only accepted changes atomically and paginates without provider identifiers", async () => {
  const app = await buildApp(),
    owner = await account(),
    id = await order(owner.id),
    store = new PostgresCollection(),
    providerId = `PRIVATE_ATTEMPT_${randomUUID()}`;
  await pool.query(
    "INSERT INTO payments.provider_orders(order_id,provider_id,amount_paise,state) VALUES($1,$2,100,'ready')",
    [id, `PRIVATE_ORDER_${randomUUID()}`],
  );
  const payment = {
    id: providerId,
    order_id: "private-order",
    amount: 100,
    currency: "INR",
    status: "created",
  };
  const count = async () =>
    Number(
      (
        await pool.query(
          "SELECT count(*) n FROM payments.attempt_observations WHERE provider_payment_id=$1",
          [providerId],
        )
      ).rows[0].n,
    );
  try {
    await Promise.all(
      Array.from({ length: 6 }, () => store.observe(id, payment)),
    );
    assert.equal(await count(), 1);
    await store.observe(id, { ...payment, status: "authorized" });
    assert.equal(await count(), 2);
    await store.observe(id, payment);
    assert.equal(await count(), 2);
    await store.observe(id, { ...payment, status: "captured" });
    await store.observe(id, { ...payment, status: "failed" });
    assert.equal(await count(), 3);
    await store.observe(id, { ...payment, status: "refunded" });
    await store.observe(id, { ...payment, status: "captured" });
    assert.equal(await count(), 4);
    await assert.rejects(
      store.observe(id, { ...payment, amount: 200 }),
      /conflicts/,
    );
    assert.equal(await count(), 4);
    const records = (
      await pool.query(
        "SELECT previous_state,state,attempt_id FROM payments.attempt_observations WHERE provider_payment_id=$1 ORDER BY recorded_at,id",
        [providerId],
      )
    ).rows;
    assert.deepEqual(
      records.map((r) => r.state),
      ["created", "authorized", "captured", "refunded"],
    );
    assert.deepEqual(
      records.map((r) => r.previous_state),
      [null, "created", "authorized", "captured"],
    );
    assert.equal(new Set(records.map((r) => r.attempt_id)).size, 1);
    await assert.rejects(
      pool.query(
        "UPDATE payments.attempt_observations SET state='failed' WHERE provider_payment_id=$1",
        [providerId],
      ),
      /immutable/,
    );
    const rolledBack = `PRIVATE_ROLLBACK_${randomUUID()}`,
      tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      await tx.query(
        "INSERT INTO payments.attempts(provider_payment_id,order_id,amount_paise,currency,state) VALUES($1,$2,100,'INR','failed')",
        [rolledBack, id],
      );
      assert.equal(
        (
          await tx.query(
            "SELECT id FROM payments.attempt_observations WHERE provider_payment_id=$1",
            [rolledBack],
          )
        ).rowCount,
        1,
      );
      await tx.query("ROLLBACK");
    } finally {
      tx.release();
    }
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM payments.attempt_observations WHERE provider_payment_id=$1",
          [rolledBack],
        )
      ).rowCount,
      0,
    );
    for (let i = 0; i < 21; i++)
      await store.observe(id, {
        ...payment,
        id: `PRIVATE_MORE_${randomUUID()}`,
        status: "failed",
      });
    const url = `/api/v1/bookings/${id}/payment-history`;
    const response = await app.inject({ url, headers: owner.headers }),
      first = paymentHistoryPage.parse(response.json());
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(first.items.length, 20);
    assert(first.nextCursor);
    assert(!response.body.includes("PRIVATE_"));
    const second = paymentHistoryPage.parse(
      (
        await app.inject({
          url: url + "?after=" + first.nextCursor,
          headers: owner.headers,
        })
      ).json(),
    );
    assert.equal(second.items.length, 5);
    assert.equal(second.nextCursor, null);
    const items = [...first.items, ...second.items];
    assert.equal(new Set(items.map((i) => i.id)).size, 25);
    assert(items.every((i) => i.attemptId));
    assert.equal(
      items.filter((i) => i.attemptId === records[0].attempt_id).length,
      4,
    );
    assert.equal(
      (await pool.query("SELECT state FROM bookings.orders WHERE id=$1", [id]))
        .rows[0].state,
      "pending_payment",
    );
  } finally {
    await app.close();
  }
});
test("Attempt history labels observations and includes a safe reference without asserting refund completion", () => {
  const attemptId = randomUUID(),
    html = renderToStaticMarkup(
      createElement(PaymentHistoryEntries, {
        items: [
          {
            id: randomUUID(),
            attemptId,
            kind: "attempt_refunded",
            occurredAt: "2026-01-01T00:00:00.000Z",
            amountPaise: 100,
            currency: "INR",
          },
        ],
      }),
    );
  assert(html.includes("Attempt observed as refunded"));
  assert(html.includes(attemptId));
  assert(!html.includes("Refund completed"));
  const initial = renderToStaticMarkup(
    createElement(PaymentHistoryPanel, { id: randomUUID(), revision: 0 }),
  );
  assert(initial.includes("history tracking was enabled"));
  assert(initial.includes("not a complete booking refund ledger"));
});

test("Payment history filters precede pagination and bind cursors to category and attempt", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    id = await order(owner.id),
    empty = await order(owner.id),
    store = new PostgresCollection();
  await pool.query(
    "INSERT INTO payments.provider_orders(order_id,amount_paise,state) VALUES($1,100,'ready')",
    [id],
  );
  const payment = {
    id: `PRIVATE_FILTER_${randomUUID()}`,
    order_id: "private-order",
    amount: 100,
    currency: "INR",
    status: "created",
  };
  const url = `/api/v1/bookings/${id}/payment-history`;
  const read = async (params: Record<string, string> = {}) => {
    const response = await app.inject({
      url: url + "?" + new URLSearchParams(params),
      headers: owner.headers,
    });
    assert.equal(response.statusCode, 200, response.body);
    return paymentHistoryPage.parse(response.json());
  };
  try {
    for (const status of ["created", "authorized", "captured"])
      await store.observe(id, { ...payment, status });
    const attemptId = (
      await pool.query(
        "SELECT timeline_id FROM payments.attempts WHERE provider_payment_id=$1",
        [payment.id],
      )
    ).rows[0].timeline_id as string;
    for (let i = 0; i < 21; i++)
      await store.observe(id, {
        ...payment,
        id: `PRIVATE_OTHER_${randomUUID()}`,
        status: "failed",
      });
    for (let i = 0; i < 25; i++)
      await pool.query(
        "INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency) VALUES($1,$2,100,'INR')",
        [`PRIVATE_CAPTURE_FILTER_${randomUUID()}`, id],
      );
    await pool.query(
      "INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise) VALUES($1,$2,$3,'private',100)",
      [randomUUID(), id, `PRIVATE_RECOVERY_FILTER_${randomUUID()}`],
    );
    const captures = await read({ category: "captures" });
    assert.equal(captures.items.length, 20);
    assert(captures.items.every((i) => i.kind === "capture_recorded"));
    const rest = await read({
      category: "captures",
      after: captures.nextCursor!,
    });
    assert.equal(rest.items.length, 5);
    assert.equal(rest.nextCursor, null);
    const attempts = await read({ category: "attempts" });
    assert.equal(attempts.items.length, 20);
    assert(attempts.items.every((i) => i.attemptId));
    const older = await read({
      category: "attempts",
      after: attempts.nextCursor!,
    });
    assert.equal(older.items.length, 4);
    const single = await read({
      category: "attempts",
      attemptId: attemptId.toUpperCase(),
    });
    assert.equal(single.items.length, 3);
    assert(single.items.every((i) => i.attemptId === attemptId));
    assert.equal(single.nextCursor, null);
    assert.equal((await read({ category: "recovery" })).items.length, 1);
    assert.equal(
      (await read({ category: "attempts", attemptId: randomUUID() })).items
        .length,
      0,
    );
    for (const params of [
      { category: "attempts", after: captures.nextCursor! },
      { category: "attempts", attemptId, after: attempts.nextCursor! },
      { attemptId },
      { category: "captures", attemptId },
      { category: "bad" },
      { category: "attempts", attemptId: "invalid" },
    ] as Record<string, string>[])
      assert.equal(
        (
          await app.inject({
            url: url + "?" + new URLSearchParams(params),
            headers: owner.headers,
          })
        ).statusCode,
        422,
      );
    const all = await read(),
      legacy = JSON.parse(Buffer.from(all.nextCursor!, "base64url").toString());
    delete legacy.category;
    delete legacy.attemptId;
    const oldCursor = Buffer.from(JSON.stringify(legacy)).toString("base64url");
    assert((await read({ after: oldCursor })).items.length > 0);
    assert.equal(
      (
        await app.inject({
          url: url + "?category=attempts&attemptId=" + attemptId,
          headers: other.headers,
        })
      ).statusCode,
      404,
    );
    assert.deepEqual(
      paymentHistoryPage.parse(
        (
          await app.inject({
            url: `/api/v1/bookings/${empty}/payment-history?category=attempts&attemptId=${attemptId}`,
            headers: owner.headers,
          })
        ).json(),
      ),
      { items: [], nextCursor: null },
    );
  } finally {
    await app.close();
  }
});

test("Customer case booking filter precedes pagination and preserves ownership and cursor scope", async () => {
  const app = await buildApp(),
    owner = await account(),
    other = await account(),
    booking = await order(owner.id),
    secondBooking = await order(owner.id),
    foreign = await order(other.id);
  await pool.query(
    "INSERT INTO support.cases(id,owner_id,subject,category,booking_id,created_at) SELECT gen_random_uuid(),$1,'Booking-specific fixture','booking',$2,'2026-01-01T00:00:00.123456Z' FROM generate_series(1,102)",
    [owner.id, booking],
  );
  const unrelated = randomUUID();
  await pool.query(
    "INSERT INTO support.cases(id,owner_id,subject,category,booking_id) VALUES($1,$2,'Unrelated case','booking',$3)",
    [unrelated, owner.id, secondBooking],
  );
  await pool.query(
    "INSERT INTO support.cases(id,owner_id,subject,category,booking_id) VALUES($1,$2,'Private other-account case','booking',$3)",
    [randomUUID(), other.id, foreign],
  );
  const get = (params: Record<string, string> = {}, headers = owner.headers) =>
    app.inject({
      url: "/api/v1/cases?" + new URLSearchParams(params),
      headers,
    });
  try {
    assert.equal(
      (await app.inject({ url: "/api/v1/cases?bookingId=" + booking }))
        .statusCode,
      401,
    );
    const response = await get({ bookingId: booking }),
      first = customerCasePage.parse(response.json());
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(first.items.length, 100);
    assert(first.items.every((i) => i.booking_id === booking));
    assert(first.nextCursor);
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: owner.headers,
      payload: {
        bookingId: booking,
        subject: "Contextual booking help",
        category: "booking",
        body: "Please help with this linked booking.",
      },
    });
    assert.equal(create.statusCode, 200, create.body);
    const second = customerCasePage.parse(
      (
        await get({
          bookingId: booking.toUpperCase(),
          after: first.nextCursor!,
        })
      ).json(),
    );
    assert.equal(second.items.length, 2);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.id)).size,
      102,
    );
    for (const params of [
      { after: first.nextCursor! },
      { bookingId: secondBooking, after: first.nextCursor! },
    ] as Record<string, string>[])
      assert.equal((await get(params)).statusCode, 422);
    assert.equal(
      (
        await get(
          { bookingId: booking, after: first.nextCursor! },
          other.headers,
        )
      ).statusCode,
      422,
    );
    assert.equal(
      customerCasePage.parse((await get({ bookingId: foreign })).json()).items
        .length,
      0,
    );
    assert.equal(
      customerCasePage.parse(
        (await get({ bookingId: booking, caseId: unrelated })).json(),
      ).items.length,
      0,
    );
    assert.equal(
      customerCasePage.parse(
        (await get({ bookingId: booking, caseId: first.items[0].id })).json(),
      ).items.length,
      1,
    );
    assert.equal((await get({ bookingId: "invalid" })).statusCode, 422);
    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/cases",
      headers: owner.headers,
      payload: {
        bookingId: foreign,
        subject: "Invalid linked booking",
        category: "booking",
        body: "This foreign booking must not be linked.",
      },
    });
    assert.equal(denied.statusCode, 404);
  } finally {
    await app.close();
  }
});
test("Customer support navigation retains the selected booking and encodes page cursors", () => {
  const booking = randomUUID(),
    caseId = randomUUID(),
    cursor = "opaque+/= value";
  assert.equal(customerCaseLink(), "/cases");
  const page = new URL(
    customerCaseLink({ bookingId: booking, after: cursor }),
    "http://local.invalid",
  );
  assert.equal(page.searchParams.get("bookingId"), booking);
  assert.equal(page.searchParams.get("after"), cursor);
  const detail = new URL(
    customerCaseLink({ bookingId: booking, caseId }),
    "http://local.invalid",
  );
  assert.equal(detail.searchParams.get("bookingId"), booking);
  assert.equal(detail.searchParams.get("caseId"), caseId);
  assert(!detail.searchParams.has("after"));
  assert.equal(
    new URL(
      customerCaseLink({ bookingId: booking }),
      "http://local.invalid",
    ).searchParams.get("bookingId"),
    booking,
  );
});

test("Customer case status and category filters combine with booking pagination and reject cursor reuse", async () => {
  const app = await buildApp(),
    owner = await account(),
    booking = await order(owner.id),
    otherBooking = await order(owner.id);
  await pool.query(
    "INSERT INTO support.cases(id,owner_id,subject,category,state,booking_id,created_at) SELECT gen_random_uuid(),$1,'Filtered payment cases','payment','open',$2,'2026-01-01T00:00:00.123456Z' FROM generate_series(1,102)",
    [owner.id, booking],
  );
  for (const [state, category, linked] of [
    ["resolved", "payment", booking],
    ["open", "booking", booking],
    ["open", "payment", otherBooking],
  ])
    await pool.query(
      "INSERT INTO support.cases(id,owner_id,subject,category,state,booking_id) VALUES($1,$2,'Nonmatching case',$3,$4,$5)",
      [randomUUID(), owner.id, category, state, linked],
    );
  const read = (params: Record<string, string>) =>
    app.inject({
      url: "/api/v1/cases?" + new URLSearchParams(params),
      headers: owner.headers,
    });
  const filters = { bookingId: booking, state: "open", category: "payment" };
  try {
    const response = await read(filters),
      first = customerCasePage.parse(response.json());
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(first.items.length, 100);
    assert(
      first.items.every(
        (i) =>
          i.state === "open" &&
          i.category === "payment" &&
          i.booking_id === booking,
      ),
    );
    const second = customerCasePage.parse(
      (await read({ ...filters, after: first.nextCursor! })).json(),
    );
    assert.equal(second.items.length, 2);
    assert.equal(second.nextCursor, null);
    for (const changed of [
      { ...filters, state: "resolved" },
      { ...filters, category: "booking" },
      { bookingId: booking },
    ])
      assert.equal(
        (await read({ ...changed, after: first.nextCursor! })).statusCode,
        422,
      );
    assert.equal(
      customerCasePage.parse(
        (await read({ ...filters, state: "resolved" })).json(),
      ).items.length,
      1,
    );
    assert.equal(
      customerCasePage.parse(
        (await read({ ...filters, category: "booking" })).json(),
      ).items.length,
      1,
    );
    await pool.query(
      "UPDATE support.cases SET state='resolved',version=version+1 WHERE id=$1",
      [second.items[0].id],
    );
    assert.equal(
      customerCasePage.parse(
        (await read({ ...filters, after: first.nextCursor! })).json(),
      ).items.length,
      1,
    );
    assert.equal(
      customerCasePage.parse(
        (await read({ caseId: second.items[0].id })).json(),
      ).items[0].state,
      "resolved",
    );
    assert.equal((await read({ state: "invalid" })).statusCode, 422);
    assert.equal((await read({ category: "invalid" })).statusCode, 422);
    assert.equal(
      customerCasePage.parse(
        (await read({ ...filters, state: "escalated" })).json(),
      ).items.length,
      0,
    );
  } finally {
    await app.close();
  }
});
test("Customer case filter form and links preserve booking context while resetting page selection", () => {
  const booking = randomUUID(),
    html = renderToStaticMarkup(
      createElement(CustomerCaseFiltersForm, {
        bookingId: booking,
        state: "open",
        category: "payment",
        onNavigate: () => {},
      }),
    );
  assert(html.includes('name="bookingId"'));
  assert(html.includes(booking));
  assert(html.includes("Case status"));
  assert(html.includes("Case category"));
  assert(html.includes("Apply case filters"));
  assert(!html.includes('name="after"'));
  assert(!html.includes('name="caseId"'));
  const href = new URL(
    customerCaseLink({
      bookingId: booking,
      state: "open",
      category: "payment",
      after: "cursor +",
      caseId: null,
    }),
    "http://local.invalid",
  );
  assert.equal(href.searchParams.get("state"), "open");
  assert.equal(href.searchParams.get("category"), "payment");
  assert.equal(href.searchParams.get("bookingId"), booking);
  assert.equal(href.searchParams.get("after"), "cursor +");
  assert(html.includes(`href="/cases?bookingId=${booking}"`));
});
