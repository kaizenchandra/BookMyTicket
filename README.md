# BookMyTicket

India/INR ticket-booking platform under active implementation. **Not a completed or production-ready platform.** No live payment, external email delivery, supplier, payout or cloud deployment has been verified. Local Mailpit SMTP signup/login is verified.


Current local demo (**v0.85.0**): [Movies](http://127.0.0.1:3101/movies?city=) · [Events](http://127.0.0.1:3101/events?city=) · [Sports](http://127.0.0.1:3101/sports?city=) · [Provider workspace](http://127.0.0.1:3101/partner/venues).

The user-requested sample catalog contains **4 fictional movies, 4 events, 3 sports fixtures and 22 sessions**, clearly labeled DEMO. Choose a **Free session** to test actual reservation → confirmation → QR ticket → cancellation. Priced demo sessions cannot collect real payments. [Demo setup, operator sign-in and limits](docs/runbooks/cinema-sports-demo.md).

Implemented subsets include PostgreSQL reservations, immutable commercial quotes and accepted orders, confirmation and ticket/ledger transactions, OTP controls and authenticator MFA, published discovery, onboarding drafts, support cases, customer payment initiation/recovery, session management, listing favorites and initial role interfaces. The customer appearance is inferred: browser access to the reference was unavailable.

- [Current progress and blockers](docs/progress.md)
- [Verified development commands](docs/development.md)
- [Architecture and decisions](docs/architecture/initial-design.md)
- [Requirement register](docs/requirements/traceability.md)
- [Actual integration test results](docs/evidence/integration-tests.txt)
- [Local HTTP smoke results](docs/evidence/local-smoke.json)

The root frontend/backend specifications and prompt remain the complete acceptance scope. No MVP substitution is intended. Existing source requirement files and IDE changes have been preserved.

Local Compose setup: `node scripts/setup-compose.mjs`, then `docker compose up --build -d --wait`. See [development instructions](docs/development.md) for isolated container tests and recovery checks. The verified deployment is at http://127.0.0.1:3101 (separate verification project); the default Compose port is 3100.

- [Remaining implementation phases](docs/implementation-phases.md)

Version 0.4.0 adds the `/partner/venues` catalog/venue/plan/scheduling workspace and saved seating metadata in the customer journey. Full acceptance scope remains open.

### Local email verification

The running app is http://127.0.0.1:3101 and its Mailpit inbox is http://127.0.0.1:8025. Request a verification code in the app, read it in Mailpit, and enter it to sign up or log in. Emails are captured locally, not delivered externally. See [setup and verification](docs/runbooks/local-email-login.md).

Version 0.8.0 adds the support case workspace at `/operations`: authorized agents can filter and claim cases, set priority, escalate, resolve/reopen, and send explicitly labeled customer replies or internal notes. A platform support grant and fresh MFA are required. See [workflow decisions and remaining scope](docs/architecture/adr-011-support-workflow.md).

Version 0.9.0 adds staff invitations and role management in `/partner`. Owners verify MFA in account security, invite an email as editor/viewer, and manage access; recipients sign in with that verified email and accept in the partner portal. Invitations expire after seven days. No invitation email is sent. See [workflow and limitations](docs/architecture/adr-012-provider-staff.md).

Version 0.10.0 adds `/notifications`: persisted booking confirmation, pending cancellation and payment recovery notices with read/unread state and booking links. Support staff can inspect exhausted inbox deliveries and request audited replay in `/operations`. These are in-app messages, not external email/SMS deliveries. See [delivery design and limits](docs/architecture/adr-013-in-app-notifications.md).

Version 0.11.0 supports explicitly authorized free bookings. Pricing staff approve a new policy with “Authorize free bookings” in `/admin/pricing` and assign it to an occurrence. When the full quote is ₹0, customers accept the policies and choose “Confirm free booking”; the server consumes inventory and issues tickets without a payment transaction. Existing policies do not authorize this by default. See [eligibility and transaction rules](docs/architecture/adr-014-free-bookings.md).

Version 0.12.0 adds full cancellation of confirmed free bookings when the accepted policy explicitly allows it before a configured cutoff. Customers review affected tickets and confirm cancellation; unused tickets are revoked and capacity is returned atomically. No refund is due for these zero-total bookings. Paid/partial cancellation is not included. See [policy and concurrency rules](docs/architecture/adr-015-free-cancellation.md).

Event organizers can now create structured event drafts and connect them to sessions, attendee forms and booking. See [event booking setup and verification](docs/runbooks/event-booking.md).

[Razorpay checkout configuration, recovery and verification blockers](docs/runbooks/razorpay-checkout.md). Payment provider credentials remain unconfigured locally; live processing is not verified.

Customer booking UI now includes a poster-led detail page, grouped showtimes, interactive seat selection and a clearer checkout summary. [Reference observations and visual verification limits](docs/evidence/booking-design-reference-audit.md).

Organizers can preview and atomically create daily/weekly session series with excluded dates from the venue scheduling form. Existing-series editing remains outstanding.

Version 0.21.0 adds encrypted online-event joining links, organizer access-window controls and ticket-holder access from confirmed bookings. [Access rules and provider limitations](docs/architecture/adr-023-online-event-access.md).

Version 0.22.0 adds [searchable audit history](http://127.0.0.1:3101/admin/audit) with actor/action/target/time filters and cursor pagination. Platform audit permission and recent MFA are required. [Usage and limitations](docs/runbooks/audit-history.md).

Version 0.23.0 adds [searchable My bookings](http://127.0.0.1:3101/bookings), status/date/timing filters, pagination and immutable saved listing titles for new bookings. [Usage and historical-data limitations](docs/runbooks/booking-history.md).

Version 0.24.0 adds controlled support-case reassignment in /operations with separate supervisor permission, active-agent validation, reasons, safe retries and audit records. [Workflow and access requirements](docs/runbooks/support-assignment.md).

Version 0.25.0 adds customer-requested escalation for unresolved support cases at /cases, with a recorded reason, safe retries and support queue visibility. [Workflow and limits](docs/runbooks/customer-escalation.md).

Version 0.26.0 adds booking references to customer support-case creation and restricted current booking context for authorized support agents. [Usage and remaining scope](docs/runbooks/support-booking-context.md).

Version 0.27.0 makes first-party support-case creation retry-safe while the form remains open: unchanged retries recover the saved case, with no duplicate initial message. [Behavior and compatibility limits](docs/runbooks/case-creation-retries.md).

Version 0.28.0 adds durable retries to first-party customer replies and staff messages. Identical retries recover the original message without duplicating it or reopening later-resolved cases. [Usage and limits](docs/runbooks/support-reply-retries.md).

Version 0.29.0 adds support queue pagination with Next, Previous and First page controls, preserving filters and access checks for older cases. [Navigation and live-data behavior](docs/runbooks/support-queue-pagination.md).

Version 0.30.0 adds supervisor-only support agent search and selection for case assignment. Active platform eligibility is rechecked when saving. [Workflow and access limits](docs/runbooks/support-agent-directory.md).

Version 0.31.0 makes first-party support workflow actions retry-safe while the view remains open. Unchanged retries recover the original result without repeating transitions or overwriting later work. [Recovery and compatibility limits](docs/runbooks/support-action-retries.md).

Version 0.32.0 adds durable customer inbox notices for staff replies, with owner-checked links to the exact support case. Internal notes stay private. [Delivery behavior and limits](docs/runbooks/support-reply-notifications.md).

Version 0.33.0 adds paginated customer support history, with case summaries and links to individual conversations. [Navigation and limits](docs/runbooks/customer-case-history.md).

Version 0.34.0 adds bounded customer conversation pages with Older, Newer, Latest and Refresh controls. Internal notes remain excluded. [Navigation and API behavior change](docs/runbooks/customer-conversation-pages.md).

Version 0.35.0 adds bounded staff conversation pages while preserving unsent edits and reviewed case versions. [Navigation and API behavior change](docs/runbooks/staff-conversation-pages.md).

Version 0.36.0 adds durable in-app supervisor assignment notices with protected links to current case detail. [Delivery, privacy and access rules](docs/runbooks/assignment-notifications.md).

Version 0.36.1 fixes notification pagination skipping notices created within the same millisecond and clears stale navigation after failed loads. [Pagination behavior and regression evidence](docs/runbooks/notification-history.md).

Version 0.37.0 audits supervisor directory access without recording search text or contacts. Failed audit writes prevent results from being returned. [Review and failure behavior](docs/runbooks/support-directory-audit.md).

Version 0.38.0 adds public venue pages linked from showtimes and seating, with addresses/directions, amenities/accessibility and paginated upcoming sessions. Publication and provider-approval checks protect private venues. [Scope and recovery](docs/runbooks/public-venues.md).

Version 0.39.0 adds provider editing and public display of transport, parking and venue entry guidance, alongside amenities/accessibility. Saves enforce organization write permissions, version conflicts and atomic auditing. [Editing and recovery](docs/runbooks/venue-guidance.md).

Version 0.40.0 adds provider-managed venue phone/email details with explicit public-display permission, private defaults and withdrawal. Public responses omit private contacts; saves enforce tenant permissions, version conflicts and atomic auditing. [Contact editing and recovery](docs/runbooks/venue-contact.md).

Version 0.41.0 adds ordered venue photo/map references with descriptions, attribution, provider preview/removal and a customer gallery. External images load on request. [Media editing and remaining upload scope](docs/runbooks/venue-media.md).

Version 0.42.0 adds venue favorites with save/remove controls, account-owned pagination and unavailable-venue redaction. [Saved venues](http://127.0.0.1:3101/favorites/venues) · [Behavior and recovery](docs/runbooks/venue-favorites.md).

Version 0.43.0 adds preferred-city editing and version-protected profile saves with explicit conflict recovery. Discovery uses URL/device selection before account preference. PUT /api/v1/profile now requires expectedVersion. [Profile workflow and compatibility](docs/runbooks/profile-city.md).

Version 0.44.0 adds optional encrypted saved attendees with explicit storage consent, withdrawal and manual checkout field reuse. Existing bookings remain unchanged when shortcuts are removed. [Consent, encryption and recovery](docs/runbooks/saved-attendees.md).

Version 0.45.0 adds scheduled venue addresses/directions to the ticket wallet and downloaded tickets, with addresses in calendar exports. Missing addresses retain an explicit fallback. [Directions behavior and verification](docs/runbooks/ticket-directions.md).

Version 0.46.0 adds inbox unread totals, marking displayed notifications read, and marking individual notifications unread again. Atomic owner-scoped updates leave later arrivals unchanged. [Inbox controls](docs/runbooks/inbox-actions.md).

Version 0.47.0 adds owner-only organization name corrections, visible review feedback and resubmission after changes are requested, with version checks and preserved drafts. [Correction workflow](docs/runbooks/provider-corrections.md).

Version 0.48.0 adds private owner business/contact onboarding drafts and an audited moderator view. Business name/address, contact person and email are now required before submission or approval. [Workflow and existing-application impact](docs/runbooks/private-provider-onboarding.md).

Version 0.49.0 adds immutable provider review history, retry-safe decisions, paginated owner/reviewer views and the reviewer rejection action. [Review history workflow and limitations](docs/runbooks/provider-review-history.md).

Version 0.50.0 adds paginated provider review queues and cinema/event/sports filters, removing the admin UI’s 100-application ceiling. [Queue behavior and verification](docs/runbooks/provider-review-queue.md).

Version 0.51.0 adds the [listing review queue](http://127.0.0.1:3101/admin/listings), with stable pagination beyond 100 submissions, movie/event/sports filters and inline decision/reason forms. [Workflow and limits](docs/runbooks/listing-review-queue.md).

Version 0.52.0 adds immutable listing review decisions with reviewer attribution, retry-safe processing and an original-decision retry control. [Recovery behavior and demo reviewer configuration](docs/runbooks/listing-review-retries.md).

Version 0.53.0 adds audited listing decision-history pages for organization members and moderators, including reasons, versions, timestamps and pagination. [History scope and access](docs/runbooks/listing-review-history.md).

Version 0.54.0 adds saved listing revisions to member/moderator history pages, including retained pre-change content and legacy reasons with exact pagination and restricted attribution. [Revision semantics and limits](docs/runbooks/listing-revisions.md).

Version 0.55.0 adds protected saved-revision comparisons with From/To selection across history pages and side-by-side changed values. [Comparison workflow and scope](docs/runbooks/revision-comparison.md).

Version 0.56.0 adds allowlisted movie/event/sports details to saved revision history and comparisons, with readable labels and private-field omission. [Supported fields and historical limits](docs/runbooks/category-revision-history.md).

Version 0.57.0 retains additional category content on future saves—crew, event organizer/inclusions/exclusions, and sports season/individual teams/hospitality—for history and comparisons, while preserving earlier command retry fingerprints. [Capture behavior](docs/runbooks/category-history-capture.md).

Version 0.58.0 adds durable listing submission retries and a frontend Retry original submission action, preserving later review/publication state. [Recovery behavior](docs/runbooks/listing-submission-retries.md).

Version 0.59.0 adds durable generic draft-edit replay and Retry original draft save recovery, retaining the current form and protecting later server changes. [Recovery behavior](docs/runbooks/generic-draft-retries.md).

Version 0.60.0 adds keyed generic listing creation and frontend original-creation recovery. Generic creation API callers must now supply Idempotency-Key; the browser does so automatically. [Contract and recovery behavior](docs/runbooks/generic-listing-creation.md).

Version 0.61.0 adds duplicate-safe organization creation and original-request recovery in the provider form. API clients must now send Idempotency-Key. [Usage and compatibility](docs/runbooks/organization-creation.md).

Version 0.62.0 adds durable provider submission recovery, including retries after later corrections or approval, with an original-submission retry control. [Behavior and legacy limits](docs/runbooks/provider-submission-retries.md).

Version 0.63.0 adds durable organization-name draft recovery with original-input retry and preservation of different unsaved text. [Workflow and legacy limits](docs/runbooks/provider-draft-retries.md).

Version 0.64.0 adds audited private onboarding save recovery without duplicating contact payloads in command records, plus original-request retry and preservation of different entered details. [Workflow and limits](docs/runbooks/onboarding-save-retries.md).

Version 0.65.0 adds owner invitation-history pagination beyond the former 100-record limit, with First/Previous/Next controls and exact API cursors. [Usage and compatibility](docs/runbooks/provider-invitation-pages.md).

Version 0.66.0 adds recipient invitation pagination beyond the former 100-item inbox limit, preserving contact isolation and invitation expiry. [Usage and API compatibility](docs/runbooks/recipient-invitation-pages.md).

Version 0.67.0 preserves exact bigint membership versions for staff role changes and revocation, rejecting unsafe numeric inputs while accepting legacy safe numbers. [API guidance](docs/runbooks/membership-versions.md).

Version 0.68.0 adds independent staff member pagination with role/revocation controls on every page. API clients must paginate member lists beyond 20 entries. [Usage and compatibility](docs/runbooks/member-pages.md).

Version 0.69.0 adds durable invitation revocation recovery with original-request retry and protection for replacement invitations. [Workflow and limits](docs/runbooks/invitation-revocation-retries.md).

Version 0.70.0 adds durable staff role/revocation recovery that preserves later roles and replacement memberships. [Workflow and limits](docs/runbooks/membership-action-recovery.md).

Version 0.71.0 adds owner invitation-status filters with correct server-time expiry and independent member navigation. [Usage](docs/runbooks/invitation-status-filters.md).

Version 0.72.0 adds member-role filters with independent invitation navigation and existing protected-owner controls. [Usage](docs/runbooks/member-role-filters.md).

Version 0.73.0 adds private customer marketing-consent history with grants, withdrawals, policy versions and pagination beside communication preferences. [Usage](docs/runbooks/marketing-consent-history.md).

Version 0.74.0 adds private saved-attendee consent history that remains available after withdrawal without exposing attendee details. [Usage](docs/runbooks/attendee-consent-history.md).

Version 0.75.0 retains consent wording with new marketing and saved-attendee history entries and explicitly labels missing legacy wording. [Usage](docs/runbooks/retained-consent-wording.md).

Version 0.76.0 adds booking, payment and support notification filters combined with unread views and pagination. [Usage](docs/runbooks/notification-categories.md).

Version 0.77.0 adds All/Unread/Read notification views combined with categories and pagination, preserving legacy unread API queries. [Usage](docs/runbooks/notification-read-filters.md).

Version 0.78.0 adds atomic Mark displayed read notifications as unread, limited to the current page. [Usage](docs/runbooks/bulk-unread-notifications.md).

Version 0.79.0 adds inclusive India event-date filters to the notification inbox and API, combined with category, read status and pagination. [Usage](docs/runbooks/notification-date-ranges.md).

Version 0.80.0 guards Favorites against stale account/resource responses, binds sign-in save intent to its original resource, and adds explicit retrieval/state contracts and retry states. [Usage and limits](docs/runbooks/favorites-recovery.md).

Version 0.81.0 adds [searchable Help](http://127.0.0.1:3101/help), public FAQ keyword/topic search and contextual booking/payment help links. Six versioned articles are maintained through code review; administrative editing remains open. [Usage](docs/runbooks/help-search.md).

Version 0.82.0 adds [Help administration](http://127.0.0.1:3101/admin/help) for authorized moderation staff: preview, edit and publish/unpublish existing FAQ answers with version checks, durable retries and audit records. Public Help reads PostgreSQL content. [Usage](docs/runbooks/help-administration.md).

Version 0.83.0 adds protected FAQ revision history with prior content, staff attribution, reasons and stable pagination. Loading history keeps the current editor draft. [Usage](docs/runbooks/help-revision-history.md).

Version 0.84.0 adds unpublished FAQ draft creation with controlled internal destinations, unique article IDs, retained retry requests and immutable creation receipts. Review and publish drafts through the existing editor. [Usage](docs/runbooks/help-draft-creation.md).

Version 0.85.0 adds FAQ administration search, publication filters and twenty-item cursor pages. API clients must follow nextCursor for the full collection. [Usage](docs/runbooks/help-administration-list.md).
