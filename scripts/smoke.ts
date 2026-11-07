import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const baseUrl = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:3000";
const checks = [];
for (const suffix of [
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
  ["/partner/venues", 200],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/venues", 401],
  ["/api/v1/admin/pricing/policies", 401],
  ["/explore", 200],
  ["/profile", 200],
  ["/admin/pricing", 200],
  ["/operations", 200],
  ["/api/v1/operations/cases", 401],
  ["/api/v1/provider-invitations", 401],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/cinema", 401],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/sports", 401],
  ["/movies", 200],
  ["/sports", 200],
  ["/api/v1/notifications", 401],
  ["/api/v1/operations/notification-deliveries", 401],
  ["/notifications", 200],
  ["/partner", 200],
  ["/api/v1/organizations/00000000-0000-4000-8000-000000000001/staff", 401],
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
  if (path === "/health") assert.equal(body.version, "0.15.0");
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
