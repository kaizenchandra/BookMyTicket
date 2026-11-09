import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const baseUrl = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:3000";
const checks = [];
{
  const path =
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff/00000000-0000-4000-8000-000000000002";
  const response = await fetch(baseUrl + path, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ version: "9007199254740993", role: "viewer" }),
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "PUT", status: response.status });
}

{
  const path =
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/onboarding";
  const response = await fetch(baseUrl + path, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: "{}",
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "PUT", status: response.status });
}

{
  const path =
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/draft";
  const response = await fetch(baseUrl + path, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({ name: "Smoke draft", expectedVersion: 1 }),
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "PUT", status: response.status });
}

{
  const path = "/api/v1/listings/00000000-0000-4000-8000-000000000001";
  const response = await fetch(baseUrl + path, {
    method: "PUT",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: "{}",
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "PUT", status: response.status });
}
{
  const path =
    "/api/v1/operations/cases/00000000-0000-4000-8000-000000000001/assignment";
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "idempotency-key": "smoke-assignment",
    },
    body: JSON.stringify({
      version: 1,
      assigneeId: "00000000-0000-4000-8000-000000000002",
      reason: "Smoke authentication check",
    }),
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "POST", status: response.status });
}
{
  const path = "/api/v1/cases/00000000-0000-4000-8000-000000000001/escalation";
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "idempotency-key": "smoke-escalation",
    },
    body: JSON.stringify({ version: 1, reason: "Smoke authentication check" }),
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "POST", status: response.status });
}
for (const path of [
  "/api/v1/occurrences/series",
  "/api/v1/occurrences/series/preview",
  "/api/v1/organizations",
  "/api/v1/organizations/00000000-0000-4000-8000-000000000001/invitations/00000000-0000-4000-8000-000000000002/revoke",
  "/api/v1/organizations/00000000-0000-4000-8000-000000000001/submit",
  "/api/v1/organizations/00000000-0000-4000-8000-000000000001/listings",
  "/api/v1/listings/00000000-0000-4000-8000-000000000001/submit",
]) {
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: path.endsWith("/revoke") ? JSON.stringify({ version: 1 }) : "{}",
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "POST", status: response.status });
}
for (const suffix of [
  "online-access/00000000-0000-4000-8000-000000000001",
  "payment/reconcile",
  "pending-cancellation/preview",
  "pending-cancellation",
  "free-cancellation/preview",
  "free-cancellation",
]) {
  const path = `/api/v1/bookings/00000000-0000-4000-8000-000000000001/${suffix}`;
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: "{}",
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "POST", status: response.status });
}

{
  const path =
    "/api/v1/bookings/00000000-0000-4000-8000-000000000001/free-confirmation";
  const response = await fetch(baseUrl + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      "idempotency-key": "smoke-free-confirmation",
    },
    body: JSON.stringify({ confirm: true }),
  });
  assert.equal(response.status, 401);
  checks.push({ path, method: "POST", status: response.status });
}

for (const [path, expected] of [
  ["/api/v1/bookings?q=example&state=confirmed", 401],
  ["/admin/audit", 200],
  ["/admin/provider-history", 200],
  ["/api/v1/admin/providers", 401],
  ["/api/v1/admin/listings", 401],
  ["/admin/listings", 200],
  [
    "/api/v1/listings/00000000-0000-4000-8000-000000000001/revisions/compare?fromId=1&toId=2",
    401,
  ],
  [
    "/api/v1/admin/listings/00000000-0000-4000-8000-000000000001/revisions/compare?fromId=1&toId=2",
    401,
  ],
  ["/api/v1/listings/00000000-0000-4000-8000-000000000001/revisions", 401],
  [
    "/api/v1/admin/listings/00000000-0000-4000-8000-000000000001/revisions",
    401,
  ],
  ["/admin/listing-history", 200],
  ["/partner/listing-history", 200],
  ["/api/v1/listings/00000000-0000-4000-8000-000000000001/reviews", 401],
  ["/api/v1/admin/listings/00000000-0000-4000-8000-000000000001/reviews", 401],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/reviews", 401],
  ["/api/v1/admin/providers/00000000-0000-4000-8000-000000000001/reviews", 401],
  ["/api/v1/admin/audit", 401],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/events", 401],
  ["/api/v1/catalog/00000000-0000-4000-8000-000000000001/events", 404],
  [
    "/api/v1/occurrences/00000000-0000-4000-8000-000000000001/registration-form",
    401,
  ],
  [
    "/api/v1/reservations/00000000-0000-4000-8000-000000000001/registration-form",
    401,
  ],
  ["/api/v1/bookings/00000000-0000-4000-8000-000000000001/registration", 401],
  [
    "/api/v1/occurrences/00000000-0000-4000-8000-000000000001/attendee-exports",
    401,
  ],
  [
    "/api/v1/attendee-exports/00000000-0000-4000-8000-000000000001/download",
    401,
  ],
  ["/api/v1/bookings/00000000-0000-4000-8000-000000000001/tickets", 401],
  [
    "/api/v1/bookings/00000000-0000-4000-8000-000000000001/tickets/download",
    401,
  ],
  ["/api/v1/bookings/00000000-0000-4000-8000-000000000001/calendar", 401],
  ["/health", 200],
  ["/ready", 200],
  ["/api/v1/catalog", 200],
  ["/api/v1/catalog?sort=title&language=Hindi", 200],
  ["/api/v1/catalog/suggestions?q=movie", 200],
  ["/api/v1/cities", 200],
  ["/api/v1/config", 200],
  ["/api/v1/auth/mfa", 401],
  ["/api/v1/auth/sessions", 401],
  ["/api/v1/favorites", 401],
  ["/api/v1/bookings/00000000-0000-4000-8000-000000000001/payment", 401],
  ["/favorites", 200],
  ["/favorites/venues", 200],
  ["/api/v1/venue-favorites", 401],
  ["/partner/venues", 200],
  [
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/onboarding",
    401,
  ],
  [
    "/api/v1/admin/providers/00000000-0000-4000-8000-000000000001/onboarding",
    401,
  ],
  ["/venue/00000000-0000-4000-8000-000000000001", 200],
  ["/api/v1/venues/00000000-0000-4000-8000-000000000001", 404],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/venues", 401],
  ["/api/v1/admin/pricing/policies", 401],
  ["/explore", 200],
  ["/profile", 200],
  ["/api/v1/profile/attendees", 401],
  ["/api/v1/profile/communications/history", 401],
  ["/admin/pricing", 200],
  ["/operations", 200],
  ["/operations?caseId=00000000-0000-4000-8000-000000000001", 200],
  ["/api/v1/operations/cases", 401],
  ["/api/v1/cases?caseId=00000000-0000-4000-8000-000000000001", 401],
  ["/api/v1/operations/support-agents?q=fixture", 401],
  ["/api/v1/provider-invitations", 401],
  [
    "/api/v1/provider-invitations?afterCreatedAt=2026-01-02T03%3A04%3A05.123456Z&afterId=00000000-0000-4000-8000-000000000001",
    401,
  ],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/cinema", 401],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/sports", 401],
  ["/movies", 200],
  ["/sports", 200],
  ["/api/v1/notifications", 401],
  ["/api/v1/operations/notification-deliveries", 401],
  ["/notifications", 200],
  ["/partner", 200],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff", 401],
  [
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff?memberRole=editor",
    401,
  ],
  [
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff?invitationState=expired",
    401,
  ],
  [
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff?afterMemberId=00000000-0000-4000-8000-000000000002",
    401,
  ],
  [
    "/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff?afterCreatedAt=2026-01-02T03%3A04%3A05.123456Z&afterId=00000000-0000-4000-8000-000000000001",
    401,
  ],
  ["/api/v1/operations/cases/00000000-0000-4000-8000-000000000001", 401],
  ["/scanner", 200],
] as const) {
  const response = await fetch(baseUrl + path),
    content = await response.text();
  assert.equal(response.status, expected, `${path} HTTP status`);
  const json = response.headers
    .get("content-type")
    ?.includes("application/json");
  const body = json ? JSON.parse(content) : undefined;
  if (path === "/health") assert.equal(body.version, "0.28.0");
  if (!json)
    assert(content.includes('<div id="root">'), `${path} frontend entrypoint`);
  checks.push({
    path,
    status: response.status,
    contentType: response.headers.get("content-type"),
    ...(json ? { body } : { htmlEntry: true }),
  });
}
await writeFile(
  "docs/evidence/local-smoke.json",
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      baseUrl,
      verificationLevel:
        "HTTP only; no browser rendering or authenticated live workflows",
      checks,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Passed ${checks.length} local HTTP smoke checks. Browser behavior remains unverified.`,
);
