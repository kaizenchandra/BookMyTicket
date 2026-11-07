# Local email signup and login with Mailpit

## Use the running application

1. Open http://127.0.0.1:3101 and choose Sign in.
2. Enter an email address and choose Send verification code.
3. Open http://127.0.0.1:8025 (also linked in the sign-in form). Find the message addressed to that email and copy its six-digit code.
4. Enter the code in BookMyTicket. A new account is created only after successful verification; returning users log in to the existing account.
5. Log out to revoke the session. Request a fresh code to log in again.

Mailpit captures messages locally; it does **not** send mail to Gmail or another external inbox. This is the explicitly requested local email-capture configuration, not evidence of production email delivery. Codes expire after five minutes, can be used once, and have a five-attempt limit. Resend requires at least 60 seconds; at most five challenges per address per hour. Changing email does not bypass backend limits.

## Reproduce the verified Docker setup

```sh
node scripts/setup-compose.mjs
APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up -d --build --wait
```

Compose defaults to `OTP_DELIVERY=mailpit`, sender `BookMyTicket <no-reply@bookmyticket.test>`, and internal SMTP `mailpit:1025`. The OTP pepper remains in the existing ignored file secret. Mailpit's inbox and SMTP are published only on `127.0.0.1:8025` and `127.0.0.1:1025`; no relay is configured. Its image is version/digest pinned. Messages are temporary, capped at 100, and periodically removed after 24 hours. Do not rely on the capture inbox for durable mail history.

The default project still uses app port 3100; the currently verified deployment is the separate project at 3101. Multiple simultaneous Compose projects need different `MAILPIT_WEB_PORT` and `MAILPIT_SMTP_PORT` values (for example 8026/1026). Do not bind the capture inbox or SMTP to public interfaces.

For native development, start the Mailpit service in Docker and use `.env.example` settings: `NODE_ENV=development`, `OTP_DELIVERY=mailpit`, `MAILPIT_SMTP_HOST=127.0.0.1`, `MAILPIT_SMTP_PORT=1025`, `MAILPIT_WEB_URL=http://127.0.0.1:8025`, a sender, and a securely configured OTP pepper of at least 32 characters. Existing `.env` files were not read or overwritten by this change. Never commit secret values.

## Real external delivery

Set `OTP_DELIVERY=resend`, a verified `OTP_FROM` and the existing secure `RESEND_API_KEY` configuration. There is no silent fallback from Mailpit to Resend. Mailpit mode is prohibited when `NODE_ENV=production` or when the environment is not explicitly development/test. `/api/v1/config` now reports OTP availability using both delivery configuration and the pepper, instead of reporting availability from Resend credentials alone. Availability means configured, not a live SMTP health check; connection failures return a truthful 503 and do not create an account.

## Verification

`tests/email-login.test.ts` starts a real HTTP application on an ephemeral loopback port against `bookmyticket_test`, sends real SMTP mail to the Mailpit container, retrieves the matching fixture email via Mailpit's API, and verifies signup, normalization, single-account returning login, authenticated profile/booking access, session cookies, logout, replay rejection, cooldown, expiry, attempt limits, SMTP failure and production-mode rejection. Codes and session cookies are never printed or written to evidence. Fixtures exist only in the isolated test database.

```sh
MAILPIT_TEST_URL=http://127.0.0.1:8025 MAILPIT_TEST_SMTP_HOST=127.0.0.1 MAILPIT_TEST_SMTP_PORT=1025 DATABASE_URL=<isolated-test-database-url> npm test
APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify --profile verification run --build --rm tests
```

The four email integration tests explicitly skip if `MAILPIT_TEST_URL` is absent. CI and Compose test services now configure Mailpit, so verified runs contain no skips. All 93 tests passed natively and in Linux containers; deployed configuration, inbox readiness and 28 HTTP smoke checks passed. Browser automation was attempted but its access host remains unavailable, so browser interaction/accessibility is not claimed verified.

Official references checked: [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/), [Mailpit runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/), [Nodemailer SMTP](https://nodemailer.com/smtp).
