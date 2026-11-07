import { test, after } from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/shared/request-origin.ts";
import { buildApp } from "../src/app.ts";
import { pool } from "../src/shared/database.ts";
after(() => pool.end());
test("Development loopback aliases require the same configured protocol and port; production stays exact", () => {
  const configured = "http://127.0.0.1:3101";
  for (const origin of [
    "http://localhost:3101",
    "http://127.0.0.1:3101",
    "http://[::1]:3101",
  ])
    assert(isAllowedOrigin(origin, configured, "development"));
  for (const origin of [
    "http://localhost:3100",
    "https://localhost:3101",
    "http://localhost.attacker.example:3101",
    "http://127.0.0.2:3101",
    "null",
    "file:///",
    "http://user@localhost:3101",
    "http://localhost:3101/path",
  ])
    assert(!isAllowedOrigin(origin, configured, "development"), origin);
  assert(!isAllowedOrigin("http://localhost:3101", configured, "production"));
  assert(isAllowedOrigin(configured, configured, "production"));
  assert(
    !isAllowedOrigin(
      "http://localhost:3101",
      "https://tickets.example",
      "development",
    ),
  );
});
test("Booking HTTP requests allow local alias but retain authentication and reject cross-site and forged host origins", async () => {
  const oldOrigin = process.env.APP_ORIGIN,
    oldEnv = process.env.NODE_ENV;
  process.env.APP_ORIGIN = "http://127.0.0.1:3101";
  process.env.NODE_ENV = "development";
  const app = await buildApp();
  const request = (
    origin: string,
    site = "same-origin",
    url = "/api/v1/reservations",
  ) =>
    app.inject({
      method: "POST",
      url,
      headers: {
        origin,
        "sec-fetch-site": site,
        host: "attacker.example",
        "x-forwarded-host": "attacker.example",
      },
      payload: {},
    });
  try {
    for (const origin of ["http://localhost:3101", "http://127.0.0.1:3101"])
      assert.equal((await request(origin)).json().code, "AUTH_REQUIRED");
    assert.equal(
      (await request("http://localhost:3101", "cross-site")).json().code,
      "ORIGIN_DENIED",
    );
    assert.equal((await request("http://attacker.example")).statusCode, 403);
    assert.equal((await request("http://localhost:3100")).statusCode, 403);
    assert.equal(
      (
        await request(
          "http://attacker.example",
          "same-origin",
          "/api/v1/payments/webhook-extra",
        )
      ).statusCode,
      403,
    );
    process.env.NODE_ENV = "production";
    assert.equal((await request("http://localhost:3101")).statusCode, 403);
  } finally {
    await app.close();
    if (oldOrigin === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = oldOrigin;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});
