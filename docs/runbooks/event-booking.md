# Event booking workflow

Local application: http://127.0.0.1:3101. This is an implemented workflow subset, not full event-platform acceptance.

1. Sign in with verified email and create an event organizer organization. Submit it for review. Authorized platform staff approve it through the existing provider-review console; privileges are not granted automatically.
2. Open `/partner/venues`, select the organization, and expand **Movies, events and sports fixtures**. Choose **Events**. Save the structured event details, including performers, organizer, duration, minimum age, inclusions, exclusions and entry instructions.
3. Submit the saved catalog draft for moderation. Authorized staff publish it. Unpublished details remain private. Use the category editor for subsequent permitted draft revisions.
4. Create the venue and hall, publish a seating plan with assigned seats or general-admission pools, and schedule concrete sessions with prices and sales windows. Each resource represents one admission unit. No couple/group/package semantics are implied by its label. Sessions cannot overlap in the same space.
5. An authorized pricing administrator must assign an approved commercial policy. Free booking requires explicit `allowFreeBookings`; free cancellation additionally requires its configured cutoff. No commercial policy is silently activated.
6. For each session, configure the attendee form. Preview uses the same customer field renderer without saving preview answers. Publish a form version. Add required age/entry declarations as appropriate; the minimum-age metadata alone does not verify a person's age.
7. Customers discover the published event at `/events`, select date/venue/session and seat or admission quantity, reserve, then review venue-local session details, final quote and policies. Required attendee answers are collected per admission and checked by the server before order acceptance. Form changes require refreshed acceptance; accepted registrations preserve their original schema.
8. A zero-total explicitly eligible order can be confirmed to issue actual locally persisted tickets without a fabricated payment. Paid orders use the existing configured Razorpay path and remain unconfirmed until trusted capture processing. Live paid-event processing has not been verified. Wallet access is owner-authorized. Eligible unused free bookings can be fully cancelled through preview/confirmation.

Version 0.19.0 adds four explicitly user-requested fictional demo events and eight sessions to the local application database. Open http://127.0.0.1:3101/events?city= to see all cities. Choose a free session to book without charges; the priced demo session is display-only and cannot collect money. The existing demo-organizer@bookmyticket.test account receives verification codes in local Mailpit at http://127.0.0.1:8025. No platform staff permissions are granted by the seed.

Repeatable seed: `APP_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p bookmyticket-verify exec -T -e ALLOW_DEMO_SEED=1 app node --import tsx scripts/seed-demo.ts`. Development mode/local database guards are enforced. Successful reruns preserve listing IDs, dates, forms and bookings rather than refreshing expired demo dates.

Opt-in local journey check: `ALLOW_DEMO_BOOKING=1 SMOKE_ORIGIN=http://127.0.0.1:3101 MAILPIT_TEST_URL=http://127.0.0.1:8025 node --import tsx scripts/verify-event-booking.ts`. This creates and cancels one free demo booking for each event and leaves its audit/history intact. It uses real local OTP delivery, never prints credentials and never attempts a paid charge. Automated regression fixtures remain in bookmyticket_test. Four actual local demo journeys have passed; evidence is events-deployed-booking.json.

Evidence: `docs/evidence/event-workflow-full-suite.txt`, `event-workflow-container-tests.txt`, `event-workflow-build.txt`, `event-workflow-deploy.txt` and `event-workflow-smoke.txt`. 117 native/container tests, 47 deployed HTTP checks. Browser access host unavailable; no browser, visual or accessibility acceptance claimed.

Still required: recurrence-rule generation/exceptions, sale phases, category-specific benefits/packages, multi-day passes, secure online joining links, postponement/disruption remedies and paid cancellation/refund orchestration. See ADR 019 and requirement traceability.

## Create a recurring schedule (0.20.0)

In the organization venue workspace, choose a saved seating plan and published listing under **Schedule an occurrence**. Fill the first session's venue-local dates, explicit UTC offsets, per-resource prices and sales windows. Choose Daily series or Weekly series; set the interval and number of candidate dates (2–24), optionally excluding comma-separated start dates. Preview the generated dates, then publish. No session is created during preview. A conflicting session rejects the entire operation; adjust the input and preview again. Identical retries return the original session IDs.

The shared sales opening applies to every session. Closing repeats with the session. Split schedules at daylight-saving offset changes; the server refuses mismatching offsets. After publishing, configure the pricing policy and attendee form for each session. Recurrence-rule editing and rescheduling already-created occurrences remain outstanding; do not directly edit transactional tables.

## Protected online joining information (v0.21.0)

In /partner/venues, expand a session's **Online joining access**. Provide an HTTPS meeting link without embedded credentials, explicit opening/closing timestamps with offsets, and enable it. Maximum window is seven days. Later edits can leave the URL blank to retain the encrypted value. Reload after a version conflict; the saved secret is never returned to the organizer editor.

Customers open their confirmed booking and choose **Get joining link** during the permitted window. Ownership, session state, ticket validity and unused entitlement are checked in the database on every request. Cancellation prevents future disclosure. No ticket is consumed by revealing a URL. The external destination opens separately and is controlled by the organizer's meeting provider.

Keep TICKET_ENCRYPTION_KEY configured securely. Existing master-key rotation must also re-encrypt events.online_access data. Do not insert actual meeting secrets in public descriptions, screenshots, test evidence or audit notes. Use external provider attendee restrictions because previously disclosed shared URLs cannot be recalled by this application.

Local tests use isolated example.org fixture links without fetching them. No demo meeting URL or fabricated external meeting was added to the application database. Browser and external-provider acceptance remain pending.
