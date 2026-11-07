# Development

Verified on macOS arm64, Node 26.13.0, npm 11.20.0 and real PostgreSQL provided by pinned `embedded-postgres` 18.6.0-beta.19. Package is a launcher for a native database process, not an in-memory substitute. Production should use an approved managed PostgreSQL service.

```sh
npm ci
npm run db:local
```

In another terminal:

```sh
cp .env.example .env
npm run migrate
npm run build
npm start
```

The local launcher uses 127.0.0.1:55432, `.local/postgres`, and an explicitly local-only password. It creates `bookmyticket_dev` without commercial fixtures. Application listens on 127.0.0.1:3000. The current running session was started with DATABASE_URL in the environment; no `.env` containing credentials was created.

```sh
node --import tsx scripts/prepare-test-db.ts
DATABASE_URL=postgresql://bookmyticket:local-only-change-me@127.0.0.1:55432/bookmyticket_test npm test
npm run build
npm run check:architecture
npm run contracts
```

Tests refuse a URL without `/bookmyticket_test`. They append uniquely identified fixtures only to the isolated database; they do not seed the development catalog. Tests exercise real transactions and HTTP injection, not external provider connectivity. Native database startup/socket access required sandbox escalation in the agent environment. Native Chrome access was rejected by automatic approval review due to possible exposure of existing private tabs; a specific browser-access question is pending.

Optional frontend development: `npx vite` uses the pinned local package and proxies /api to port 3000. Production build is served by Fastify on the same origin. `npm run worker` processes durable webhook inbox records; unsupported event families are dead-lettered, not silently accepted as processed. Outbox delivery consumers are still pending.

Configure secrets through environment/secret manager: Resend verified sender and key, OTP_PEPPER (32+ characters), Razorpay live key/secret and current/retained webhook secrets, TICKET_ENCRYPTION_KEY (64 hex characters). Do not paste secrets into chat or commit them. MFA_ENCRYPTION_KEY (64 hex characters, dedicated to authenticator secrets) enables enrollment, verification and recovery from Profile. Staff role provisioning is still pending; MFA never grants a role. Staff interfaces require both fresh MFA and an existing authorized grant. No development authentication bypass exists.

## Verification limits
No browser rendering, responsive screenshot, accessibility, camera, live OTP or live financial verification was possible. HTTP 200 for a frontend route proves only that the application entrypoint is served. Local Docker builds, container tests, restart persistence and fixture backup restoration have been executed; hosted CI has not. Performance numbers from integration tests are not load-test results or SLO evidence.


## Version 0.2.0 migrations and behavior
Migrations 005 and 006 add immutable pricing policies/quotes, accepted-order snapshot protection, actor-scoped placement idempotency, MFA factor/recovery storage and session MFA timestamps. Existing sessions without a recent MFA timestamp need fresh verification for staff actions. There are no default production policies or authenticator keys.

API: `POST /api/v1/quotes` with reservationId; `POST /api/v1/orders` with reservationId, quoteId, acceptPolicies and Idempotency-Key. The result is pending_payment, not a confirmed booking. Visit `/admin/pricing` to configure explicitly approved policies with pricing permission and fresh MFA. Missing policy configuration returns COMMERCIAL_POLICY_UNAVAILABLE. Authenticator setup/verification/recovery is available in `/profile` after real sign-in.

`tests/pricing-domain.test.ts` covers integer math/allocation; `tests/pricing-integration.test.ts` exercises actual PostgreSQL and HTTP quote/order behavior; `tests/mfa.test.ts` checks RFC vectors, actual database sessions and HTTP enrollment. Generated secrets and recovery codes stay inside test process memory and the isolated test database; evidence files do not contain them.

## Docker Compose (verified local deployment)

```sh
node scripts/setup-compose.mjs
docker compose up --build -d --wait
docker compose --profile verification build tests
docker compose --profile verification run --rm tests
```

The default address is http://127.0.0.1:3100. PostgreSQL is not exposed to the host. A separate verification project is running at http://127.0.0.1:3101; reproduce with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait`. Set both port and origin together. These are development HTTP deployments, not production cookie/TLS configurations.

Setup creates local cryptographic material in ignored `.local/compose/secrets`, preserves existing files, and leaves external credentials empty. The enclosing directory is owner-only; mounted files are readable by the unprivileged container account. Do not remove/regenerate database or encryption secrets for an existing volume. Populate external provider files securely when authorized. No credentials are baked into images. All secret variables support `_FILE` instead of a direct value; providing both fails configuration. Compose does not import `.env` into the container, although Compose itself reads interpolation settings from it.

Startup is database health → advisory-locked migration job → app and worker. `/ready` checks required migration checksums; later additive migrations are tolerated, not proven backward compatible. On first adoption, existing migrations lacking checksums are baselined from the current source: review historical migration provenance before production adoption. Migration 007 adds an expiry index. Worker health requires successful database progress within 30 seconds; failed iterations use bounded delay. It sweeps expired reservations in locked batches without clearing replacement ownership. Notification outbox delivery remains outstanding.

Container tests create/use only `bookmyticket_test`, separate from the empty `bookmyticket` application database. The `verification` profile is opt-in and not part of normal startup. Recovery evidence can be reproduced after container tests using:

```sh
APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 COMPOSE_PROJECT_NAME=bookmyticket-verify node scripts/verify-compose-recovery.mjs
SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts
```

Recovery restarts only that Compose project, creates a fixture-only backup under `.local/backups`, and restores into a new timestamped isolated database without dropping existing databases. Those copies are retained for inspection. Do not use `down -v` for routine shutdown; `docker compose stop` retains volumes. Image tags and multi-architecture digests are pinned. Runtime image omits tests and development dependencies. App/worker run as nonroot with read-only roots, bounded resources and writable temporary storage. Local PostgreSQL still uses one privileged development role; production role separation is outstanding.

Evidence: `docs/evidence/container-build.txt`, `container-tests.txt`, `compose-status.txt`, `compose-recovery.json`, and `local-smoke.json`. Forty tests passed natively and in Linux ARM64 containers. A first native test attempt was blocked by sandbox socket restrictions; the authorized rerun passed. A port conflict with another local stack was resolved by using 3101 without interrupting it.

## Version 0.3.0 — payment recovery, sessions and favorites

Migrations 008–010 add payment attempt observations/reconciliation leases and retry claims, opaque public session IDs and future sign-in timestamps, and private listing favorites. Existing sessions retain unknown historical sign-in times. No catalog or merchant records are seeded.

Customer routes: `/bookings/:id` now connects to server payment preparation, the real Razorpay checkout script, signed callbacks and status polling; `/profile` lists/revokes other sessions; `/favorites` paginates saved listings and detail pages offer Save/Remove. Sign-in preserves an explicitly pending Save action. Unpublished favorites display only an unavailable state and can be removed. Artist/team/venue favorites are not yet implemented.

API additions: `GET/POST /api/v1/bookings/:id/payment`, `POST /api/v1/bookings/:id/payment/callback`, `GET /api/v1/auth/sessions`, `DELETE /api/v1/auth/sessions/:id`, `POST /api/v1/auth/sessions/revoke-others`, and `GET/PUT/DELETE` favorites routes. Payment commands accept no client amount. Callback accepts paymentId/signature only and verifies against the stored order. The public Razorpay key ID is returned only for checkout; secret keys never are. Account-owned status requires authentication. Session revocation is serialized with MFA operations and audited without tokens/hashes. Revoked sessions immediately fail authentication.

`npm run contracts` emits 47 API paths, exact new mutation schemas, and a payment-status response schema checked by HTTP tests. Other response schemas remain incomplete. `tests/payment.test.ts`, `tests/sessions.test.ts`, and `tests/favorites.test.ts` add 14 real database/HTTP tests to the previous 40. No success-path provider substitutes are used. Live and browser verification are still outstanding. See ADR 004 for retry and polling defaults.

Final 0.3.0 deployed smoke coverage has 16 checks. The local verification database has ten migrations; restart and fixture backup restoration were repeated successfully after the additions. Neither the loopback deployment nor the fixture-based recovery checks establish production readiness.


## Version 0.4.0 — physical venue and catalog workspace

Visit `/partner/venues` after real sign-in. Select an authorized organization, save a catalog draft, edit/preview and submit it for moderation, create a venue and physical space, and save an immutable plan. Scheduling requires an approved provider and published listing. Plan version editing uses a captured space version; refreshing background data does not silently advance it. Clone a reviewed saved plan to begin a new version after a conflict. New plans never rewrite existing occurrences.

New APIs: organization-scoped venues/spaces/plans and occurrence lists, `PUT /api/v1/listings/:id` for editable drafts, and the revised `POST /api/v1/occurrences` with `Idempotency-Key`, `planId`, explicit-offset timestamps and exact per-resource prices. The old venueName/timeZone/resources payload is rejected. Venue time zones come from stored ownership-checked data. Enter separate UTC offsets for dates across daylight-saving changes; the backend rejects mismatched offsets. UTC `Z` inputs explicitly represent absolute instants. Customer occurrence inventory includes the immutable venue/plan snapshot; legacy occurrences truthfully lack one.

Migrations 011–012 add venue ownership, spaces, immutable plan versions, scheduling retry records and database guards against silent physical/snapshot changes. No test data is seeded into the application database. `tests/venues.test.ts` adds seven domain/database/HTTP tests, including eight distinct provider staff scheduling the same space concurrently. All 61 tests pass natively and in the Linux container suite. The 52-path API inventory includes exact new request schemas; complete response schemas and browser checks remain outstanding.

The isolated browser host was retried and remains unavailable. The new workspace uses existing Light/Dark tokens and accessible labels/list previews, but neither visual fidelity nor WCAG conformance is claimed without browser verification. See ADR 005 for editor bounds, public contract changes and remaining physical-plan migration work.

Final 0.4.0 verification: 18 deployed HTTP checks passed. Recovery verification now compares venue/space/plan counts and confirms that restored occurrence plan snapshots match their immutable versions, in addition to booking/reservation/journal counts, ledger balance and ownership checks. This remains a local fixture test, not a production recovery claim.


### Registration configuration
`REGISTRATION_ENCRYPTION_KEY` (64 hex characters, 32 random bytes) or its `_FILE` equivalent is required to accept/read attendee answers. Compose uses an ignored `registration_key` file created by `node scripts/setup-compose.mjs`; no secret value is printed. Preserve this key with encrypted backups; replacing it makes historical answers unreadable. Production key versioning/rotation and retention deletion remain unfinished. Never use test fixture keys in application environments.
Migration 013 adds immutable forms and encrypted registrations. Native verification: `DATABASE_URL=<isolated bookmyticket_test URL> npm test`; never run fixtures against the application database. Updated verification stack is http://127.0.0.1:3101. HTTP smoke tests do not constitute browser acceptance.

### Export configuration and verification
`EXPORT_ENCRYPTION_KEY` or `_FILE` protects export artifacts; use a distinct 32-byte hex key. `node scripts/setup-compose.mjs` creates the ignored local Compose secret without exposing it. Migration 014 and the worker are required. See [the export runbook](runbooks/attendee-exports.md). Version 0.5.0 is deployed locally at http://127.0.0.1:3101. Full native/container suite: 72 passing; HTTP smoke: 23 passing. Browser verification is unavailable.

### Ticket wallet and documents (0.6.0)
Customer ticket access is integrated in `/bookings/:id`; see [ticket access runbook](runbooks/ticket-access.md). QR codes are rendered locally with pinned `qrcode`; independent test-only `jsqr` and `ical.js` verify QR and calendar content. No new database migration is needed for this slice. Ticket display/download requires the existing protected ticket key; calendar export does not. Local deployment: http://127.0.0.1:3101. Verification: 81 native/container tests, 26 HTTP checks, local restart/fixture restore, build/contracts/architecture checks. Browser and actual print acceptance remain unavailable.

### Pending cancellation (0.7.0)
Migration 015 enables the pending-order cancellation workflow described in [the runbook](runbooks/pending-order-cancellation.md). No new external credentials are required. Native PostgreSQL on 55432 was restarted using `npm run db:local`; fixtures remain in `bookmyticket_test`. Verified local Docker app: http://127.0.0.1:3101. Full suite: 89 native/container tests; 28 HTTP smoke checks. Confirmed-ticket refunds and browser acceptance remain unverified/unimplemented as recorded in progress.

### Mailpit signup/login (0.7.1)
Local Compose now defaults to real SMTP delivery into a pinned Mailpit container. App: http://127.0.0.1:3101; inbox: http://127.0.0.1:8025. See [local email setup](runbooks/local-email-login.md) for native/Compose settings, multiple-stack port overrides and real-provider configuration. Four new HTTP+SMTP integration tests bring the native/container suite to 93 passing with zero skips; CI and Compose configure the Mailpit test dependency. Browser automation remains unavailable.

## Cinema/sports demo (v0.14.0)

See `docs/runbooks/cinema-sports-demo.md` for explicit local seed commands and operator access. `scripts/seed-demo.ts` is opt-in, development/local-host guarded and included in the application image. Do not run it against production. The active local application DB contains user-requested fictional catalog data; automated tests continue to use `bookmyticket_test`.

Verified additional commands: `node --import tsx --test tests/cinema-sports.test.ts` with the isolated DATABASE_URL; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/verify-demo.ts`. The latter checks seeded HTTP data/media, not browser rendering, and expects unexhausted demo capacity.


### Communication preferences verification (0.15.0)
`DATABASE_URL=postgresql://bookmyticket:local-only-change-me@127.0.0.1:55432/bookmyticket_test node --import tsx --test tests/communication-preferences.test.ts` passes against the isolated local database. Full native tests use the existing Mailpit variables; 115 tests pass. The existing Compose verification command also passes all 115 tests. Migration 023 is applied through the normal migration-gated local deployment. No external campaign credentials are needed or used.


### Event booking verification (0.16.0)
`tests/cinema-sports.test.ts` now includes seated and general-admission event journeys; run using the existing isolated DATABASE_URL. Full native and Docker commands above pass all 117 tests. `npm run build`, `npm run check:architecture`, `npm run contracts` pass; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` verifies 47 HTTP checks. Migration 024 follows the existing migration-gated Compose deployment.


### Razorpay recovery verification (0.17.0)
Existing native and Docker verification commands pass 120 tests. `tests/payment.test.ts` tests PostgreSQL/HTTP recovery and signed webhook ingestion with isolated fixtures, without external provider calls. Build, architecture and contract commands pass; local smoke command passes 48 checks. Migration 025 is applied through Compose startup. See `docs/runbooks/razorpay-checkout.md` for server-only credential/webhook configuration and the explicit live-verification blockers.


### Booking design verification (0.18.0)
`node --import tsx --test tests/booking-design.test.ts` runs three server-rendered component checks. Full native and Docker suites pass 123 tests; build, architecture and contracts pass; deployed smoke checks pass 48. These commands do not measure visual fidelity or replace browser accessibility verification. See the reference audit for unverified viewport/theme scenarios.


### Local booking origin configuration
Development permits localhost, 127.0.0.1 and [::1] only at the configured APP_ORIGIN protocol/port. Use one hostname consistently: session cookies are host-scoped, so switching hostnames requires signing in there. Production requires the exact configured public origin. Compose's default origin follows APP_PORT; set APP_ORIGIN explicitly for a reverse proxy or a separate frontend development server. Do not disable the origin check or add wildcard origins. Verified by tests/request-origin.test.ts and deployed origin-deployed-checks.json (v0.18.1).


### Upcoming event verification (0.19.0)
Full native/Docker suites pass 126 tests; build/typecheck, architecture and contracts pass; deployed smoke verifies 48 checks. `scripts/verify-event-booking.ts` is an opt-in LOCAL DEMO mutation check documented in runbooks/event-booking.md. Four SMTP/login-to-ticket-to-cancellation flows passed against the deployed development database. No provider charge or actual venue admission occurs. New migration 026 backfills the discovery projection; ongoing scheduling updates it atomically.


### Recurring scheduling verification (0.20.0)
`tests/venues.test.ts` covers recurring preview, exclusions, concurrent retry, later-conflict rollback and revoked permissions. Native/Docker full suites pass 129 tests; build/architecture/contracts pass; deployed smoke checks pass 50. Migration 027 uses the existing migration-gated Compose startup. Evidence is under docs/evidence/recurring-schedule-*. No new dependency or external service is required.

Online-event access v0.21.0 verification: npm run build, npm run check:architecture and npm run contracts passed; 129 tests passed against isolated local PostgreSQL/Mailpit and inside the Docker verification profile. Existing local deployment commands apply migration 028. The 51-check deployed smoke run passed. Evidence is in docs/evidence/online-access-*. Browser host unavailable; no interactive acceptance claimed.
