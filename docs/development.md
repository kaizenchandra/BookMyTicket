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

Audit-history v0.22.0: build/typecheck, architecture and contracts passed. Full native and Docker verification suites passed 131 tests with no skips/failures; deployed smoke passed 53 checks. Migration 029 is additive. Evidence: docs/evidence/audit-history-*. The /admin/audit screen requires the existing platform audit grant and fresh MFA; no development shortcut grants are installed.

Booking-history v0.23.0: npm run build, npm run check:architecture and npm run contracts passed. All 133 tests passed natively and in the Docker verification profile; deployed smoke passed 54 checks. Migration 030 adds owner-scoped indexes. Existing local deployment commands apply; the interrupted Docker runtime was restarted and the final artifact rebuilt. Evidence: docs/evidence/booking-history-*. Browser acceptance remains blocked by unavailable tooling.

Support assignment v0.24.0: npm run build, npm run check:architecture and npm run contracts pass. Full suites pass 135 tests natively and in Docker; deployed smoke passes 55 checks. Existing native PostgreSQL was restarted with npm run db:local after interruption. Migration 031 retains assignment retry results. The separate support_assign grant is not automatically provisioned. Evidence: docs/evidence/support-assignment-*.

Customer escalation v0.25.0: build/typecheck, architecture and contracts pass; 137 tests pass natively and in Docker, with 56 deployed HTTP checks. Migration 032 is additive and retains retry outcomes. Evidence: docs/evidence/customer-escalation-*. Browser interaction remains unverified.

Booking-linked support v0.26.0: build/typecheck, architecture and contracts pass; native and Docker suites pass 138 tests with no skips/failures; deployed smoke passes 56 checks. Migration 033 adds a nullable logical booking reference. Evidence: docs/evidence/support-booking-*. Browser verification remains unavailable.

Case-creation retries v0.27.0: build/typecheck, architecture and contracts pass; native and Docker suites pass 139 tests, deployed smoke passes 56 checks. Migration 034 persists command fingerprints/results. Evidence: docs/evidence/case-retries-*. Browser acceptance remains unverified.

Support reply retries v0.28.0: build/typecheck, architecture and contracts pass; 140 native/container tests pass, with 56 deployed HTTP smoke checks. Migration 035 stores durable reply outcomes. Evidence: docs/evidence/reply-retries-*. Browser acceptance remains unverified.

Support queue pagination v0.29.0: existing build/typecheck, architecture and contracts commands pass. Full native tests with the documented Mailpit variables and Docker verification profile pass 141 tests; deployed smoke passes 56 checks. Migration 036 is applied by normal migration-gated startup. The focused command is `DATABASE_URL=postgresql://bookmyticket:local-only-change-me@127.0.0.1:55432/bookmyticket_test node --import tsx --test tests/support-operations.test.ts`. Evidence: docs/evidence/queue-pagination-*. Browser host remains unavailable.

Support agent directory v0.30.0: existing native and Docker full-suite commands pass 142 tests without skips; build/typecheck, architecture and contracts pass, with 97 API paths. Deployed smoke passes 57 checks. `tests/support-assignment.test.ts` covers restricted directory search and eligibility changes before assignment. No migration or new environment variable is required. Evidence: docs/evidence/agent-directory-*. Browser acceptance remains unverified.

Support action retries v0.31.0: existing build/typecheck, architecture and contracts commands pass. Native and Docker suites pass 143 tests without skips; deployed smoke passes 57 checks. Migration 037 follows normal migration-gated startup. Focused verification uses `tests/support-operations.test.ts` with the documented isolated DATABASE_URL. Evidence: docs/evidence/action-retries-*. Browser acceptance remains unverified.

Support reply notices v0.32.0: build/typecheck, architecture and contracts pass; 144 native and Docker tests pass without skips and 58 deployed smoke checks pass. The focused PostgreSQL/HTTP coverage is in tests/support-operations.test.ts. No migration or new configuration is required; deploy app and worker together to enable the new outbox event type. Evidence: docs/evidence/support-notices-*. Browser acceptance remains unverified.

Customer case history v0.33.0: build/typecheck, architecture and contracts pass; full native and Docker suites pass 145 tests without skips, and deployed smoke passes 58 checks. Migration 038 adds an owner-scoped history index through existing migration-gated startup. Focused coverage is in tests/support-operations.test.ts using the documented isolated DATABASE_URL. Evidence: docs/evidence/case-history-*. Browser acceptance remains unverified.

Customer conversation pages v0.34.0: build/typecheck, architecture and contracts pass; full native and Docker suites pass 146 tests without skips, and deployed smoke passes 58 checks. Migration 039 follows existing migration-gated startup. Focused coverage is in tests/support-operations.test.ts; tests/inventory.test.ts validates the page envelope and audience isolation. Evidence: docs/evidence/conversation-pages-*. Browser acceptance remains unverified.

Staff conversation pages v0.35.0: build/typecheck, architecture and contracts pass; native and Docker suites pass 147 tests without skips, and deployed smoke passes 58 checks. Migration 040 is applied by normal migration-gated startup. Focused PostgreSQL/HTTP verification is in tests/support-operations.test.ts. Evidence: docs/evidence/staff-thread-*. Browser acceptance remains unverified.

Assignment notices v0.36.0: build/typecheck, architecture and contracts pass; native and Docker full suites pass 148 tests without skips, and deployed smoke passes 59 checks. No migration or new configuration is required; deploy app and worker together for the new event type. Focused coverage is in tests/support-assignment.test.ts. Evidence: docs/evidence/assignment-notices-*. HTTP deep-link checks verify entrypoint serving, not browser selection/accessibility acceptance.

Inbox precision v0.36.1: build/typecheck, architecture and contracts pass; full native and Docker suites pass 149 tests without skips and deployed smoke passes 59 checks. tests/notifications.test.ts contains the regression for sub-millisecond pagination; inbox-precision-regression-before.txt is intentionally failing pre-fix evidence. No migration or configuration change is required. Passing evidence: docs/evidence/inbox-precision-*. Browser acceptance remains unverified.

Directory access audit v0.37.0: build/typecheck, architecture and contracts pass; full native and Docker suites pass 150 tests without skips and deployed smoke passes 59 checks. tests/support-assignment.test.ts covers success/empty-page audit fields, privacy, audit-history visibility and real-transaction rollback under injected audit failure. The initial database-unavailable log is retained separately. No migration or configuration change is needed. Passing evidence: docs/evidence/directory-audit-*. Browser acceptance remains unverified.

## Public venue verification (0.38.0)
`npm run build`, `npm run check:architecture` and `npm run contracts` pass (165 module files, 98 paths). With the isolated test DATABASE_URL, `node --import tsx --test tests/venues.test.ts` and the documented full `npm test` command pass; full native and Compose verification each report 151 passes, zero failures/skips. Migration 041 is applied by the existing migration service. The existing local verification Compose project was rebuilt with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait`; all services are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 61 checks. Evidence prefix: docs/evidence/public-venues-. Browser rendering/keyboard/accessibility remains unverified.

## Venue guidance verification (0.39.0)
The documented native full-suite and Compose verification commands each pass 152 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/venues.test.ts`. `npm run build`, `npm run check:architecture` and `npm run contracts` pass (165 module files; 99 API paths). Migration 042 ran through the existing Compose migration service. Rebuilt the local verification deployment with the existing APP_PORT=3101 and APP_ORIGIN configuration; services are healthy and `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 61 HTTP checks. Evidence: docs/evidence/venue-guidance-*.txt. Browser verification remains open.

## Venue contact verification (0.40.0)
The documented native full suite and isolated Compose verification each pass 153 tests with no failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/venues.test.ts`. Build/typecheck, architecture (165 module files) and contract generation (100 paths) pass. Migration 043 was applied by the existing migration service during the local verification deployment update. All services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 61 checks. Evidence prefix: docs/evidence/venue-contact-. Browser behavior remains unverified.

## Venue media verification (0.41.0)
The documented native and isolated Docker suites each pass 155 tests with zero failures/skips. Focused backend command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/venues.test.ts`; frontend initial-render check: `node --import tsx --test tests/venue-media-ui.test.ts`. Build/typecheck, architecture (166 module files), and contracts (101 paths) pass. Migration 044 ran through the existing migration service. Local Compose services are healthy, and `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 61 HTTP checks. Evidence prefix: docs/evidence/venue-media-. Render checks do not establish browser image-loading or accessibility acceptance.

## Venue favorites verification (0.42.0)
Native and isolated Docker suites each pass 156 tests without failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/venues.test.ts`. Build/typecheck, architecture (169 module files) and contract generation (103 paths) pass. Migration 045 ran through the existing migration service during local Compose update; services are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 63 HTTP checks. Evidence prefix: docs/evidence/venue-favorites-. Browser/sign-in continuation and accessibility remain unverified.

## Profile city verification (0.43.0)
Native and isolated Docker suites each pass 157 tests, zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/profile.test.ts`. Build/typecheck, architecture (171 module files) and contracts (103 paths) pass. No migration is needed. Local Compose services are healthy and `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 63 checks. Evidence prefix: docs/evidence/profile-city-. PUT /api/v1/profile now requires expectedVersion from GET; old clients must update. Browser/city precedence/cross-tab/accessibility acceptance remains open.

## Saved attendee verification (0.44.0)
Native and isolated Docker suites each pass 159 tests with no failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/profile.test.ts tests/saved-attendees-ui.test.ts`. Build/typecheck, architecture (174 files) and contracts (104 paths) pass. Migration 046 runs through the existing migration service. The existing REGISTRATION_ENCRYPTION_KEY/secret-file setting also derives a separate saved-attendee key; preserve it securely. All local services are healthy, and `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 64 checks. Evidence prefix: docs/evidence/saved-attendees-. Browser/checkout/accessibility acceptance remains open.

## Ticket directions verification (0.45.0)
Native and isolated Docker suites each pass 162 tests without failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/tickets.test.ts tests/ticket-directions.test.ts`. Build/typecheck, architecture (175 files) and contracts (104 paths) pass. No migration/configuration change is required. Local Compose services are healthy, and `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 64 checks. Evidence prefix: docs/evidence/ticket-directions-. Live maps, file-viewer/print/browser/accessibility acceptance remains open.

## Inbox actions verification (0.46.0)
Native and isolated Docker suites each pass 163 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/notifications.test.ts`. Build/typecheck, architecture (175 files) and contracts (105 paths) pass. Migration 047 creates the unread owner index through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 64 checks. Evidence prefix: docs/evidence/inbox-actions-. Browser/accessibility/load acceptance remains open.

## Provider draft verification (0.47.0)
Native and isolated Docker suites each pass 165 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/provider-drafts.test.ts`. Build/typecheck, architecture (178 files) and contracts (106 paths) pass. No migration is needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 64 checks. Evidence prefix: docs/evidence/provider-drafts-. Unauthorized submission now returns FORBIDDEN (403). Browser/multi-organization/accessibility acceptance remains open.

## Private provider onboarding verification (0.48.0)
Native and isolated Docker suites each pass 166 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/provider-drafts.test.ts tests/catalog-publication.test.ts tests/cinema-sports.test.ts`. Build/typecheck, architecture (182 files) and contracts (108 paths) pass. Migration 048 creates the private details table via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 66 checks. Evidence prefix: docs/evidence/provider-onboarding-. Existing incomplete applications must supply required details before submission/approval. Browser/accessibility and complete onboarding acceptance remain open.

## Provider review history verification (0.49.0)
Native and isolated Docker suites each pass 167 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/provider-drafts.test.ts`. `npm run build`, `npm run check:architecture` (185 module files) and `npm run contracts` (110 paths) pass. Migration 049 ran through the existing migration service. Local Compose services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 69 HTTP checks. Evidence prefix: docs/evidence/provider-review-history-. HTTP and server-render checks do not establish authenticated browser or accessibility acceptance.

## Provider queue verification (0.50.0)
Native and isolated Docker suites each pass 169 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/provider-drafts.test.ts`. `npm run build`, `npm run check:architecture` (186 module files), and `npm run contracts` (111 paths) pass. Migration 050 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 70 HTTP checks. Evidence prefix: docs/evidence/provider-queue-. Tests include real PostgreSQL pagination beyond 100 records and server-rendered navigation controls; authenticated browser/navigation/accessibility and load behavior remain unverified.

## Listing queue verification (0.51.0)
Native and isolated Docker suites each pass 171 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (187 module files) and `npm run contracts` (112 paths) pass. Migration 051 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 72 HTTP checks. Evidence prefix: docs/evidence/listing-queue-. PostgreSQL and server-render tests do not establish browser/navigation/accessibility or load acceptance.

## Listing decision retry verification (0.52.0)
Native and isolated Docker suites each pass 172 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts tests/catalog-publication.test.ts`. `npm run build`, `npm run check:architecture` (187 module files) and `npm run contracts` (112 paths) pass. Migration 052 ran via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 72 HTTP checks. Evidence prefix: docs/evidence/listing-review-retries-. Browser retry, unsaved-navigation and accessibility acceptance remain unverified. Future demo publication requires an existing authorized `DEMO_REVIEWER_ID`; this verification did not run the seed or create grants in the application database.

## Listing decision history verification (0.53.0)
Native and isolated Docker suites each pass 174 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (190 module files) and `npm run contracts` (114 paths) pass. No new migration is required beyond existing migration 052. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 76 HTTP checks. Evidence prefix: docs/evidence/listing-review-history-. Integration and initial-render tests do not establish browser/navigation/accessibility acceptance.

## Saved revision verification (0.54.0)
Native and isolated Docker suites each pass 176 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (193 module files) and `npm run contracts` (116 paths) pass. Migration 053 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 78 HTTP checks. Evidence prefix: docs/evidence/listing-revisions-. Backend and server-render checks do not establish browser/navigation/accessibility acceptance.

## Revision comparison verification (0.55.0)
Native and isolated Docker suites each pass 177 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (194 module files) and `npm run contracts` (118 paths) pass. No new migration is required beyond migration 053. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 80 HTTP checks. Evidence prefix: docs/evidence/revision-comparison-. Domain, integration and server-render checks do not establish browser/paging/accessibility acceptance.

## Category revision verification (0.56.0)
Native and isolated Docker suites each pass 179 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (195 module files) and `npm run contracts` (118 paths) pass. No new migration is required beyond migration 053. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 80 HTTP checks. Evidence prefix: docs/evidence/category-revision-history-. Domain, integration and server-render checks do not establish browser/accessibility acceptance.

## Category retention verification (0.57.0)
Native and isolated Docker suites each pass 180 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/cinema-sports.test.ts tests/listing-review-queue.test.ts`. `npm run build`, `npm run check:architecture` (195 module files) and `npm run contracts` (118 paths) pass. No new migration is required beyond migration 053. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 80 HTTP checks. Evidence prefix: docs/evidence/category-history-capture-. Backend workflow and server-render checks do not establish browser/accessibility acceptance.

## Listing submission verification (0.58.0)
Native and isolated Docker suites each pass 181 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts tests/catalog-publication.test.ts`. `npm run build`, `npm run check:architecture` (195 module files) and `npm run contracts` (118 paths) pass. Migration 054 ran via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 81 HTTP checks. Evidence prefix: docs/evidence/listing-submit-retries-. Backend and HTTP checks do not establish browser retry/accessibility acceptance.

## Generic draft replay verification (0.59.0)
Native and isolated Docker suites each pass 182 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts tests/catalog-publication.test.ts`; the full suite also exercises updated `tests/venues.test.ts` concurrency assertions. `npm run build`, `npm run check:architecture` (195 module files) and `npm run contracts` (118 paths) pass. Migration 055 ran via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 82 HTTP checks. Evidence prefix: docs/evidence/draft-edit-retries-. Browser retry/form-preservation/accessibility acceptance remains unverified.

## Generic creation verification (0.60.0)
Native and isolated Docker suites each pass 183 tests with zero failures/skips. Focused command: `DATABASE_URL=<isolated-test-url> node --import tsx --test tests/listing-review-queue.test.ts tests/catalog-publication.test.ts tests/provider-staff.test.ts tests/venues.test.ts`. `npm run build`, `npm run check:architecture` (195 module files) and `npm run contracts` (118 paths) pass. Migration 056 ran via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 83 HTTP checks. Evidence prefix: docs/evidence/catalog-create-retries-. Generic listing creation now requires Idempotency-Key; browser recovery/confirmation/accessibility acceptance remains unverified.

## Organization creation verification (0.61.0)
Native and isolated Docker suites each pass 184 tests with zero failures/skips. Focused coverage is in tests/provider-drafts.test.ts, tests/provider-staff.test.ts, tests/catalog-publication.test.ts and tests/cinema-sports.test.ts. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 057 ran via the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 84 HTTP checks. Evidence prefix: docs/evidence/provider-create-retries-. Organization creation requires Idempotency-Key; browser recovery/accessibility acceptance remains unverified.

## Provider submission verification (0.62.0)
Native and isolated Docker full suites each pass 185 tests with zero failures/skips. Provider submission coverage lives in tests/provider-drafts.test.ts. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 058 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 85 HTTP checks. Evidence prefix: docs/evidence/provider-submission-retries-. The initial focused failure is retained as iteration evidence; both final full suites pass. Browser recovery/accessibility acceptance remains unverified.

## Organization draft verification (0.63.0)
Native and isolated Docker full suites each pass 186 tests with zero failures/skips. Focused provider-drafts.test.ts tests also pass. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 059 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 86 HTTP checks. Evidence prefix: docs/evidence/provider-draft-retries-. Browser retry/form-preservation/accessibility acceptance remains unverified.

## Private onboarding recovery verification (0.64.0)
Native and isolated Docker full suites each pass 187 tests with zero failures/skips. Focused tests/provider-drafts.test.ts coverage also passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 060 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 87 HTTP checks. Evidence prefix: docs/evidence/onboarding-save-retries-. Browser recovery/session/form/accessibility acceptance remains unverified.

## Owner invitation pagination verification (0.65.0)
Native and isolated Docker full suites each pass 188 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage also passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 061 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 88 HTTP checks. Evidence prefix: docs/evidence/invitation-pages-. Browser pagination/accessibility and load acceptance remain unverified.

## Recipient invitation pagination verification (0.66.0)
Native and isolated Docker suites each pass 189 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage also passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 062 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 89 HTTP checks. Evidence prefix: docs/evidence/recipient-pages-. Browser navigation/accessibility and load acceptance remain unverified.

## Membership version verification (0.67.0)
Native and isolated Docker suites each pass 190 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 90 HTTP checks. Evidence prefix: docs/evidence/membership-versions-. Browser staff-management acceptance remains unverified.

## Member pagination verification (0.68.0)
Native and isolated Docker suites each pass 191 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 91 HTTP checks. Evidence prefix: docs/evidence/member-pages-. Browser navigation/accessibility and load acceptance remain unverified.

## Invitation revocation verification (0.69.0)
Native and isolated Docker suites each pass 192 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 063 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 92 HTTP checks. Evidence prefix: docs/evidence/invitation-revocation-. Browser recovery/accessibility remains unverified.

## Membership action recovery verification (0.70.0)
Native and isolated Docker suites each pass 193 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. Migration 064 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 92 HTTP checks. Evidence prefix: docs/evidence/membership-recovery-. Browser recovery/accessibility remains unverified.

## Invitation status filter verification (0.71.0)
Native and isolated Docker suites each pass 194 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 93 HTTP checks. Evidence prefix: docs/evidence/invitation-filters-. Browser filters/navigation/accessibility and load acceptance remain unverified.

## Member role filter verification (0.72.0)
Native and isolated Docker suites each pass 195 tests with zero failures/skips. Focused tests/provider-staff.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (118 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 94 HTTP checks. Evidence prefix: docs/evidence/member-filters-. Browser filters/navigation/accessibility and load acceptance remain unverified.

## Marketing consent history verification (0.73.0)
Native and isolated Docker suites each pass 196 tests with zero failures/skips. Focused tests/communication-preferences.test.ts coverage passes. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (119 paths) pass. Migration 065 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 95 HTTP checks. Evidence prefix: docs/evidence/consent-history-. Browser/session/navigation/accessibility acceptance remains unverified.

## Saved attendee consent history verification (0.74.0)
Native and isolated Docker suites each pass 198 tests with zero failures/skips. Focused profile, communication-preferences and saved-attendees-ui tests pass. `npm run build`, `npm run check:architecture` (198 module files) and `npm run contracts` (120 paths) pass. Migration 066 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 96 HTTP checks. Evidence prefix: docs/evidence/attendee-consent-history-. Browser/session/navigation/accessibility acceptance remains unverified.

## Consent wording verification (0.75.0)
Native and isolated Docker suites each pass 199 tests with zero failures/skips. Focused profile, communication-preferences and saved-attendees-ui tests pass. `npm run build`, `npm run check:architecture` (199 module files) and `npm run contracts` (120 paths) pass. Migration 067 ran through the existing migration service. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 96 HTTP checks. Evidence prefix: docs/evidence/consent-wording-. Browser/accessibility acceptance remains unverified.

## Notification category verification (0.76.0)
Native and isolated Docker suites each pass 200 tests with zero failures/skips. Focused tests/notifications.test.ts coverage passes. `npm run build`, `npm run check:architecture` (199 module files) and `npm run contracts` (120 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 97 HTTP checks. Evidence prefix: docs/evidence/notification-categories-. Browser/navigation/accessibility and load acceptance remain unverified.

## Notification read-status verification (0.77.0)
Native and isolated Docker suites each pass 201 tests with zero failures/skips. Focused tests/notifications.test.ts coverage passes. `npm run build`, `npm run check:architecture` (199 module files) and `npm run contracts` (120 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 98 HTTP checks. Evidence prefix: docs/evidence/notification-status-. Browser interaction/accessibility and load acceptance remain unverified.

## Bulk unread verification (0.78.0)
Native and isolated Docker suites each pass 202 tests with zero failures/skips. Focused tests/notifications.test.ts coverage passes. `npm run build`, `npm run check:architecture` (199 module files) and `npm run contracts` (121 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 99 HTTP checks. Evidence prefix: docs/evidence/notification-bulk-unread-. Browser interaction/accessibility and load acceptance remain unverified.

## Notification date verification (0.79.0)
Native and isolated Docker suites each pass 203 tests with zero failures/skips. Focused tests/notifications.test.ts coverage passes. `npm run build`, `npm run check:architecture` (199 module files) and `npm run contracts` (121 paths) pass. No migration was needed. Local services are healthy; `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passes 100 HTTP checks. Evidence prefix: docs/evidence/notification-dates-. Browser interaction/accessibility and load acceptance remain unverified.

## Favorites recovery verification (0.80.0)
`npm test` passed 205 tests against both the isolated native database/Mailpit and Docker verification environment, without failures or skips. `npm run build`, `npm run check:architecture` (200 module files) and `npm run contracts` (121 paths) passed. The existing local Compose stack was rebuilt with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait`. No migration was required. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 100 HTTP checks. Evidence prefix: docs/evidence/favorites-recovery-. Browser/sign-in/accessibility and load acceptance remain unverified.

## Help search verification (0.81.0)
`npm test` passed 208 tests natively and in isolated Docker, without failures or skips. `npm run build`, `npm run check:architecture` (204 module files) and `npm run contracts` (122 paths) passed. Existing local services were rebuilt with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait` and are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 102 HTTP checks. No migration was required. Evidence prefix: docs/evidence/help-search-. Browser/navigation/accessibility/load acceptance remains unverified.

## Help administration verification (0.82.0)
`npm test` passed 210 tests natively and in isolated Docker with no failures/skips. `npm run build`, `npm run check:architecture` (205 module files) and `npm run contracts` (124 paths) passed. Migration 068 ran through the existing migration service during `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait`; local services are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 104 HTTP checks. Evidence prefix: docs/evidence/help-admin-. Browser/editor/accessibility/load acceptance remains unverified.

## FAQ history verification (0.83.0)
`npm test` passed 212 tests natively and in isolated Docker, without failures/skips. `npm run build`, `npm run check:architecture` (205 module files) and `npm run contracts` (125 paths) passed. No migration was needed. Existing local services were rebuilt with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait` and are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 105 HTTP checks. Evidence prefix: docs/evidence/help-history-. Browser/editor/accessibility/load acceptance remains unverified.

## FAQ creation verification (0.84.0)
`npm test` passed 214 tests natively and in isolated Docker without failures/skips. `npm run build`, `npm run check:architecture` (205 module files) and `npm run contracts` (125 paths) passed. Migration 069 ran through the existing migration service during `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait`; local services are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 106 HTTP checks. Evidence prefix: docs/evidence/help-creation-. Browser/editor/accessibility/load acceptance remains unverified.

## FAQ list verification (0.85.0)
`npm test` passed 215 tests natively and in isolated Docker without failures/skips. `npm run build`, `npm run check:architecture` (205 module files) and `npm run contracts` (125 paths) passed. No migration was needed. Existing local services were rebuilt with `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify up --build -d --wait` and are healthy. `SMOKE_ORIGIN=http://127.0.0.1:3101 node --import tsx scripts/smoke.ts` passed 107 HTTP checks. Evidence prefix: docs/evidence/help-list-. Browser/editor/accessibility/load acceptance remains unverified.
