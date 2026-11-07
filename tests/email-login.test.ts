import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { buildApp } from "../src/app.ts";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { MailpitOtp } from "../src/modules/identity/adapters/mailpit.ts";
const enabled = Boolean(process.env.MAILPIT_TEST_URL);
if (!process.env.DATABASE_URL?.endsWith("/bookmyticket_test"))
  throw new Error("Email integration fixtures require isolated test database");
let app: Awaited<ReturnType<typeof buildApp>>, origin: string;
before(async () => {
  if (!enabled) return;
  await migrate();
  process.env.NODE_ENV = "test";
  process.env.OTP_DELIVERY = "mailpit";
  process.env.OTP_PEPPER = randomBytes(32).toString("hex");
  process.env.OTP_FROM = "BookMyTicket <no-reply@bookmyticket.test>";
  process.env.MAILPIT_SMTP_HOST =
    process.env.MAILPIT_TEST_SMTP_HOST ?? "127.0.0.1";
  process.env.MAILPIT_SMTP_PORT = process.env.MAILPIT_TEST_SMTP_PORT ?? "1025";
  app = await buildApp();
  origin = await app.listen({ host: "127.0.0.1", port: 0 });
  process.env.APP_ORIGIN = origin;
});
after(async () => {
  if (app) await app.close();
  await pool.end();
});
async function request(path: string, body?: unknown, cookie?: string) {
  return fetch(origin + "/api/v1" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function challenge(email: string) {
  const response = await request("/auth/challenges", { email });
  assert.equal(response.status, 200, "SMTP challenge must be accepted");
  const body = await response.json();
  assert.ok(!("code" in body), "OTP must never be returned by challenge API");
  return body;
}
async function deliveredCode(email: string, exclude?: string) {
  for (let n = 0; n < 40; n++) {
    const list = await fetch(
      process.env.MAILPIT_TEST_URL +
        "/api/v1/search?query=" +
        encodeURIComponent("to:" + email),
    ).then((r) => r.json());
    for (const item of list.messages ?? []) {
      if (item.ID === exclude) continue;
      const message = await fetch(
        process.env.MAILPIT_TEST_URL +
          "/api/v1/message/" +
          encodeURIComponent(item.ID),
      ).then((r) => r.json());
      const code = message.Text?.match(/verification code is (\d{6})/i)?.[1];
      if (code) return { code, id: item.ID };
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("No verification email received in local Mailpit");
}
const skip = enabled
  ? false
  : "Set MAILPIT_TEST_URL to run real SMTP/HTTP integration";
test(
  "Mailpit SMTP -> email verification -> signup -> authenticated session -> logout -> returning login",
  { skip },
  async () => {
    const email = `auth-${randomUUID()}@fixture.invalid`,
      c = await challenge(email.toUpperCase()),
      mail = await deliveredCode(email);
    assert.equal(
      (
        await pool.query("SELECT id FROM identity.accounts WHERE contact=$1", [
          email,
        ])
      ).rowCount,
      0,
      "Account must not exist before verification",
    );
    const wrong = ((Number(mail.code[0]) + 1) % 10) + mail.code.slice(1);
    assert.equal(
      (
        await request("/auth/verify", {
          challengeId: c.challengeId,
          code: wrong,
        })
      ).status,
      401,
    );
    const verification = await request("/auth/verify", {
      challengeId: c.challengeId,
      code: mail.code,
    });
    assert.equal(verification.status, 200);
    const principal = await verification.json(),
      header = verification.headers.get("set-cookie");
    assert.ok(header?.includes("HttpOnly"));
    assert.ok(header?.includes("SameSite=Strict"));
    const cookie = header!.split(";")[0];
    assert.equal(principal.contact, email);
    assert.equal((await request("/me", undefined, cookie)).status, 200);
    assert.equal((await request("/profile", undefined, cookie)).status, 200);
    assert.equal((await request("/bookings", undefined, cookie)).status, 200);
    assert.equal(
      (
        await request("/auth/verify", {
          challengeId: c.challengeId,
          code: mail.code,
        })
      ).status,
      401,
      "OTP is single use",
    );
    assert.equal((await request("/auth/logout", {}, cookie)).status, 200);
    assert.equal((await request("/me", undefined, cookie)).status, 401);
    // Advance only fixture cooldown metadata, never production clocks or validation.
    await pool.query(
      "UPDATE identity.challenges SET created_at=now()-interval '61 seconds' WHERE id=$1",
      [c.challengeId],
    );
    const next = await challenge(email),
      nextMail = await deliveredCode(email, mail.id),
      login = await request("/auth/verify", {
        challengeId: next.challengeId,
        code: nextMail.code,
      });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).id, principal.id);
    assert.equal(
      (
        await pool.query("SELECT id FROM identity.accounts WHERE contact=$1", [
          email,
        ])
      ).rowCount,
      1,
    );
  },
);
test(
  "real emailed OTP enforces resend cooldown, expiry and attempt limits",
  { skip },
  async () => {
    const email = `limits-${randomUUID()}@fixture.invalid`,
      c = await challenge(email),
      mail = await deliveredCode(email);
    assert.equal((await request("/auth/challenges", { email })).status, 429);
    await pool.query(
      "UPDATE identity.challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
      [c.challengeId],
    );
    assert.equal(
      (
        await request("/auth/verify", {
          challengeId: c.challengeId,
          code: mail.code,
        })
      ).status,
      401,
    );
    const other = `attempts-${randomUUID()}@fixture.invalid`,
      d = await challenge(other),
      m = await deliveredCode(other),
      wrong = ((Number(m.code[0]) + 1) % 10) + m.code.slice(1);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (
          await request("/auth/verify", {
            challengeId: d.challengeId,
            code: wrong,
          })
        ).status,
        401,
      );
    assert.equal(
      (
        await request("/auth/verify", {
          challengeId: d.challengeId,
          code: m.code,
        })
      ).status,
      401,
    );
  },
);
test(
  "Mailpit is prohibited in production and configuration reflects pepper availability",
  { skip },
  async () => {
    const delivery = new MailpitOtp({
      NODE_ENV: "production",
      OTP_DELIVERY: "mailpit",
      MAILPIT_SMTP_HOST: "mailpit",
      OTP_FROM: "no-reply@fixture.invalid",
    });
    assert.equal(delivery.available(), false);
    await assert.rejects(delivery.send("fixture@fixture.invalid", "000000"), {
      code: "OTP_UNAVAILABLE",
    });
    assert.equal((await (await request("/config")).json()).otpAvailable, true);
    const pepper = process.env.OTP_PEPPER;
    delete process.env.OTP_PEPPER;
    try {
      assert.equal(
        (await (await request("/config")).json()).otpAvailable,
        false,
      );
    } finally {
      process.env.OTP_PEPPER = pepper;
    }
  },
);
test(
  "SMTP connection failure returns truthful unavailable state and does not create an account",
  { skip },
  async () => {
    const port = process.env.MAILPIT_SMTP_PORT;
    process.env.MAILPIT_SMTP_PORT = "1";
    const email = `failure-${randomUUID()}@fixture.invalid`;
    try {
      const response = await request("/auth/challenges", { email });
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "OTP_DELIVERY_FAILED");
      assert.equal(
        (
          await pool.query(
            "SELECT id FROM identity.accounts WHERE contact=$1",
            [email],
          )
        ).rowCount,
        0,
      );
    } finally {
      process.env.MAILPIT_SMTP_PORT = port;
    }
  },
);
