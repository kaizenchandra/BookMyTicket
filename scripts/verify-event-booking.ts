// Opt-in local DEMO verification. No paid order is initiated. No credentials/ticket tokens are logged.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
const origin = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:3101",
  mailpit = process.env.MAILPIT_TEST_URL ?? "http://127.0.0.1:8025";
for (const url of [origin, mailpit])
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname))
    throw Error("Local verification only");
if (process.env.ALLOW_DEMO_BOOKING !== "1")
  throw Error("Requires ALLOW_DEMO_BOOKING=1");
let cookie = "";
async function call(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
) {
  const response = await fetch(origin + "/api/v1" + path, {
    method,
    headers: {
      origin,
      "content-type": "application/json",
      cookie,
      "idempotency-key": randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    200,
    `${path}: ${data.code ?? response.status}`,
  );
  return { data, response };
}
const email = "demo-organizer@bookmyticket.test";
const query =
  mailpit + "/api/v1/search?query=" + encodeURIComponent("to:" + email);
const prior = new Set(
  ((await (await fetch(query)).json()).messages ?? []).map((m: any) => m.ID),
);
const challenge = (await call("/auth/challenges", { email })).data;
let code: string | undefined;
for (let attempt = 0; attempt < 30 && !code; attempt++) {
  const messages = (await (await fetch(query)).json()).messages ?? [];
  for (const message of messages) {
    if (prior.has(message.ID)) continue;
    const detail = await (
      await fetch(mailpit + "/api/v1/message/" + encodeURIComponent(message.ID))
    ).json();
    code = detail.Text?.match(/verification code is (\d{6})/i)?.[1];
    if (code) break;
  }
  if (!code) await new Promise((resolve) => setTimeout(resolve, 100));
}
assert(code, "Local SMTP OTP was not delivered");
const login = await call("/auth/verify", {
  challengeId: challenge.challengeId,
  code,
});
cookie = login.response.headers.get("set-cookie")!.split(";")[0];
const checks = [];
try {
  const catalog = (await call("/catalog?kind=event&upcoming=true")).data;
  const events = catalog.items.filter((x: any) => x.metadata.demo === "true");
  assert.equal(events.length, 4);
  for (const event of events) {
    assert(event.nextSession);
    assert.equal((await fetch(origin + event.poster_url)).status, 200);
    const sessions = (await call(`/catalog/${event.id}/occurrences`)).data
      .items;
    const session = sessions.find(
      (s: any) => s.is_demo && s.min_price_paise === 0 && s.available_units > 0,
    );
    assert(session);
    const inventory = (await call(`/occurrences/${session.id}/inventory`)).data;
    const resource = inventory.resources.find(
      (r: any) => r.price_paise === 0 && r.available > 0,
    );
    assert(resource);
    const hold = (
      await call("/reservations", {
        items: [
          { occurrenceId: session.id, resourceId: resource.id, quantity: 1 },
        ],
      })
    ).data;
    const preview = (await call(`/reservations/${hold.id}/registration-form`))
      .data;
    assert(preview.form);
    const quote = (await call("/quotes", { reservationId: hold.id })).data;
    assert.equal(quote.prices.totalPaise, 0);
    const order = (
      await call("/orders", {
        reservationId: hold.id,
        quoteId: quote.id,
        acceptPolicies: true,
        registration: {
          formId: preview.form.id,
          answers: [{ name: "DEMO workflow verification", eligibility: true }],
        },
      })
    ).data;
    const confirmed = (
      await call(`/bookings/${order.id}/free-confirmation`, { confirm: true })
    ).data;
    assert.equal(confirmed.bookingState, "confirmed");
    const tickets = (await call(`/bookings/${order.id}/tickets`)).data;
    assert.equal(tickets.items.length, 1);
    assert(tickets.items[0].qrSvg);
    const cancellation = (
      await call(`/bookings/${order.id}/free-cancellation/preview`, {})
    ).data;
    await call(`/bookings/${order.id}/free-cancellation`, {
      previewId: cancellation.previewId,
      reason: "Completed authorized local demo verification",
      confirm: true,
    });
    const final = (await call(`/bookings/${order.id}`)).data;
    assert.equal(final.state, "cancelled");
    const refreshed = (await call(`/occurrences/${session.id}/inventory`)).data;
    assert.equal(
      refreshed.resources.find((r: any) => r.id === resource.id).available,
      resource.available,
    );
    checks.push({
      title: event.title,
      listingId: event.id,
      bookingId: order.id,
      seating: resource.kind,
      formVersion: preview.form.version,
      qrIssued: true,
      finalState: final.state,
      capacityRestored: true,
    });
  }
} finally {
  await call("/auth/logout", {});
  cookie = "";
}
await writeFile(
  "docs/evidence/events-deployed-booking.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      origin,
      level:
        "Actual local HTTP + Mailpit + PostgreSQL DEMO journeys; no real payment or admission; no browser verification",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Verified ${checks.length} local demo event bookings through email login, registration, tickets and cancellation.`,
);
