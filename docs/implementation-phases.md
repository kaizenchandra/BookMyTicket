# Remaining implementation phases

This is the execution queue, not a reduction of FE/BE/BASE acceptance scope. Individual clause coverage remains in requirements/traceability.json. A phase is not complete merely because a subset is implemented. No production or browser acceptance is inferred from local HTTP tests.

| Phase | Current implementation | Remaining acceptance |
|---|---|---|
| Foundation and account security | PostgreSQL, cookies/OTP adapter, TOTP/recovery, session listing/revocation, Light/Dark shell | Contact changes, staff provisioning, authorization administration, complete abuse controls and security review |
| Provider publication and venues | Onboarding drafts, private catalog editing/submission, owned venues/spaces, immutable seating plans and serialized occurrence scheduling | Resumable detailed onboarding, documents, invitations, physical remediation, bulk seat/schedule imports, provider pagination, complete publication revisions and cinema/event/sports metadata |
| Discovery and engagement | Published catalog, basic filters, actual listing favorites with cursor pagination | Expanded search/entities, filters, curated collections, detail media, venue pages, waitlists, alerts, reviews and moderation |
| Commerce | Concurrent holds, immutable itemized quotes and accepted orders | Promotions, add-on inventory, packages/passes, registration schemas, attendee details, free/complimentary eligibility |
| Payments | Server-created orders, durable intent, signed callback verification, actual query adapter, independent reconciliation, guarded failed-attempt retry, status UI | Live integration verification, operational investigation/replay UI, refund/dispute reconciliation, complete event families, approved capture and merchant configuration |
| Ticket lifecycle | Atomic issuance, encrypted tokens, QR wallet, portable HTML/calendar, server admission | PDF/resend, directions, browser/print acceptance, cancellations/previews, partial refunds, transfers/exchanges, camera/assignments/re-entry/pass UX and concurrency coverage |
| Operations and finance | Basic cases, review APIs, balanced collection journal | Assignment/escalation, controlled refunds, complete liabilities/commissions, settlements/payouts, disputes, audited configuration/import/export workflows |
| Durable engagement and privacy | Inbox processing and expiry/reconciliation workers | Notification outbox delivery/reminders, in-app notifications, data export/deletion, retention, subscriptions, authorized job replay |
| Release acceptance | Native and Linux database/HTTP tests, container deployment, local restart/fixture restore | Six-persona browser journeys, reference inspection, a11y/viewport/visual evidence, load/rollback/PITR/security checks, staging/production deployment |

Next cohesive slice: versioned attendee registration forms and event/sports registration → package/pass capacity orchestration → promotions/add-ons → ticket lifecycle and controlled refunds. Venue physical remediation, imports, provider pagination and complete category-specific scheduling remain in scope. Missing live credentials do not justify dropping independent implementation work.

Version 0.3.0 adds payment initiation/recovery, session management and listing favorites. All 54 local tests and 16 deployed HTTP checks passed; 47 API paths are inventoried. These counts describe executed checks and routes, not percentage completion. Additional product types (artists, teams, venues) do not yet have favorites support. Existing source files and IDE changes were preserved.


Version 0.4.0 adds owned venues/spaces, immutable plan versions, space-serialized scheduling with turnaround checks, private catalog draft editing/preview/submission and customer seating metadata. Sixty-one tests pass natively and in Linux containers. Browser verification remains unavailable; all broad venue/catalog requirements remain partial until their individual acceptance scope is complete.

Registration continuation: occurrence forms, provider editor, customer per-admission inputs and encrypted accepted snapshots are integrated and database-tested (64 total tests). Browser acceptance and the rest of attendee lifecycle remain open. See ADR 006 and the current progress checkpoint.

Version 0.5.0 adds bounded secure asynchronous attendee exports, current-permission checks at execution/download, MFA-gated retrieval, encrypted artifacts and expiry, with provider field/scope selection and status. Eight new tests bring the suite to 72; 23 deployed HTTP checks pass. Full export, privacy, ticket lifecycle and remaining FE/BE acceptance scope is still open. Next work: attendee corrections/retention, packages/pass capacity, promotions/add-ons, cancellation/refund orchestration and finance controls.

Version 0.6.0 adds customer QR wallet, status-aware printable HTML and credential-free calendar export. Nine additional tests bring the total to 81; 26 deployed HTTP checks pass. No browser, physical scanner, print-dialog, live payment or production acceptance is inferred. Next cohesive work remains cancellation/refund policy and workflows, attendee corrections/retention, packages/pass capacity and promotions/add-ons.

Version 0.7.0 adds owner-confirmed pending-order cancellation with expiring previews, atomic hold release, safe retries and late-capture recovery; 89 native/container tests and 28 deployed HTTP checks pass. This is not confirmed-ticket cancellation or completed refund support. Next: structured purchased cancellation policy, full/partial cancellation and provider refund orchestration, with all prior outstanding scope retained.

Version 0.8.0 continues operations: support case filters, self-assignment, priority, escalation, resolution/reopening, staff replies and internal notes, access audit and serialized version checks. Customer replies reopen resolved cases. This is a bounded workflow, not completion of support/finance requirements; supervisor reassignment, attachments, linked payment/booking context, notifications, pagination and financial actions remain open.

Version 0.9.0 adds verified-email in-app provider invitations, owner-only staff access management with fresh MFA, expiry/revocation, role changes and replay protection. Outbound invitation delivery/resend and full provider onboarding remain open. Ninety-eight tests pass in native and container environments; browser acceptance remains blocked.

Version 0.10.0 adds the durable in-app notification consumer, owner-only cursor-paginated inbox/read state and support delivery recovery. The worker atomically commits message and acknowledgment, retries bounded failures and preserves other consumers' events. 101 tests and 36 deployed HTTP checks pass; browser verification remains blocked. External notification channels, reminders, localized templates and retention remain required.

Version 0.11.0 closes the zero-total checkout gap for explicitly approved public free bookings: immutable policy eligibility, customer confirmation, atomic inventory/order/ticket/outbox persistence, safe retry and `not_required` payment status. 105 tests and 37 deployed HTTP checks pass. Restricted complimentary eligibility, confirmed-ticket cancellation/refunds, packages/passes and promotions remain open; browser acceptance remains blocked.

Version 0.12.0 adds confirmed-free full cancellation with immutable policy cutoff, expiring preview, ticket revocation, capacity release, audit and durable inbox notice. 109 tests and 39 deployed HTTP checks pass, including cancellation/admission and stale seat-ownership retry scenarios. Paid/partial refunds, packages/passes, promotions and remaining requirements stay open; browser acceptance remains blocked.

Version 0.14.0 adds typed Cinema/Sports modules and provider editors, public category detail and date/venue session selection, safe catalog filters/suggestions/pagination, and user-authorized fictional demo data. Four movies, three sports fixtures and fourteen sessions are persisted locally. Two complete category HTTP journeys and three discovery tests bring the suite to 114 passing tests; 45 deployed HTTP checks and dedicated demo-data verification pass. Browser acceptance remains blocked. Category variants, imports, concessions, passes, fulfillment, disruptions and paid refunds remain required.

Version 0.22.0 adds searchable audit metadata, bounded cursor pagination and a protected /admin/audit workspace. Full writer metadata, retention/archive and browser acceptance remain open. Latest evidence and remaining scope are maintained in progress.md; older phase entries above are historical checkpoints.

Version 0.23.0 adds searchable/paginated customer booking history and immutable title snapshots for new bookings. Partial cancellations, full booking/payment/refund/disruption timelines and browser acceptance remain open; all prior remaining scope is preserved.

Version 0.24.0 adds controlled supervisor reassignment with active-agent checks, version/idempotency protection, reasons and audit. Staff directory search, assignment notifications, broader operational actions and browser acceptance remain open. All previous remaining scope stays in force.

Version 0.25.0 adds an owner-authorized customer escalation path with reasons, queue transition and retry/concurrency protection. Browser acceptance, support attachments, linked booking context and prior remaining scope remain open.

Version 0.26.0 adds owner-validated booking references on customer cases and restricted current booking context for staff. Attachments, independent payment/refund/settlement links, full timelines, durable case-creation retry protection and browser acceptance remain required.

Version 0.27.0 closes first-party in-page support-case retry duplication using durable actor-scoped commands. Headerless legacy clients and page reloads do not receive that UI guarantee; attachments, durable reply retries and browser acceptance remain outstanding.

Version 0.28.0 adds durable keyed customer/staff reply retries with audience privacy and protection against replay reopening later-resolved cases. Legacy key adoption, draft recovery after view changes, attachments and browser acceptance remain outstanding.

Version 0.29.0 adds support queue cursor pagination with actor/filter scoping and First/Previous/Next navigation. Real database tests cover timestamp ties, new arrivals and permission changes. Browser history restoration, browser/accessibility acceptance and broader support/roadmap scope remain open.

Version 0.30.0 adds supervisor-only active support agent search/selection with scoped pagination and existing transactional assignment revalidation. Dedicated directory-read audit, scale testing, assignment notifications, browser acceptance and broader support scope remain open.

Version 0.31.0 adds durable keyed recovery for support workflow actions, preserving later case state and current access checks. Legacy key adoption, remount recovery, command retention, browser acceptance and all broader support/roadmap scope remain open.

Version 0.32.0 adds durable in-app customer notices for staff replies and exact owner-scoped case links, including older cases. Internal notes remain private and prior replies are not backfilled. Assignment notices, external channels, customer case pagination, browser acceptance and all broader support scope remain open.

Version 0.33.0 adds customer case history pagination with owner-scoped microsecond cursors, summaries and exact conversation links. Conversation-message pagination, durable drafts/scroll restoration, browser acceptance and all prior remaining scope stay open.

Version 0.34.0 adds bounded customer conversation messages with scoped cursors, chronological page display and draft-preserving in-view navigation. Staff-thread pagination, durable draft recovery, browser acceptance and all prior broader scope remain open. Clients must follow nextCursor for full message histories.

Version 0.35.0 adds bounded audited staff conversation pages, keeping unsent edits and reviewed case versions separate from message-page reads. Clients must follow nextMessageCursor for full histories. Browser acceptance, durable drafts, assignment notifications, attachments, complete timelines and prior broader requirements remain open.

Version 0.36.0 adds durable generic recipient inbox notices for supervisor assignments with current-permission case links. Historical assignments and self-claim actions are not backfilled/notified. Browser acceptance, external channels, reminder policy and prior broader requirements remain open.

Version 0.36.1 fixes skipped notification pages caused by timestamp precision loss, preserves UUID cursor compatibility and clears stale UI pagination after failed loads. Browser/error-state acceptance and prior broader requirements remain open.

Version 0.37.0 adds transactional supervisor directory access auditing with bounded account identifiers and no query/contact copies; an audit failure prevents result disclosure. Retention approval, denied-access logging, controlled exports, browser acceptance and all prior broader requirements remain open.

### Public venue progress (0.38.0)
Implemented public venue details/directions, existing amenities/accessibility, publication/provider gating and upcoming-session pagination in API and UI. Tests and local deployment are recorded in docs/progress.md. Remaining venue work includes contact permission rules, photographs, transport/parking, entry policies, independent publication and browser/accessibility acceptance. This increment does not close the full venue requirements or remaining platform phases.

### Venue guidance progress (0.39.0)
Provider editing and public display now support transport, parking and venue entry policies alongside amenities/accessibility, with tenant authorization, optimistic versions and transactional audits. Contact permissions, media, independent publication, browser/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/venue-guidance.md for evidence and recovery.

### Venue contact progress (0.40.0)
Implemented provider-managed phone/email, explicit publication permission, withdrawal, private public-response omission and customer contact display. Versioned tenant-authorized saves are audited atomically. Contact verification, media, independent venue publication and browser/accessibility acceptance remain open, along with broader platform phases. See progress.md and runbooks/venue-contact.md.

### Venue media progress (0.41.0)
Implemented ordered hosted photo/map references, metadata, provider preview/removal and the customer gallery, with versioned tenant writes and transactional auditing. Image loading is an explicit viewer action. Upload/crop, controlled storage/moderation, catalog-wide media, live external asset/browser/accessibility acceptance and independent venue publication remain open. Broader platform phases remain open; see progress.md and runbooks/venue-media.md.

### Venue favorites progress (0.42.0)
Added account-scoped venue saves/removals and pagination, unavailable-summary redaction, customer save controls and /favorites/venues. Profiles uses a public Venues contract without cross-module table reads. Artist/team favorites, alert subscriptions, browser/sign-in/accessibility acceptance, load verification and broader platform phases remain open. See progress.md and runbooks/venue-favorites.md.

### Profile preference progress (0.43.0)
Added preferred-city editing, discovery fallback and serialized versioned profile saves with draft-preserving conflict recovery. Both profile/theme callers submit expectedVersion. Verified contact changes, saved attendees, privacy workflows, browser/account-switch/cross-tab/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/profile-city.md.

### Saved attendee progress (0.44.0)
Implemented optional encrypted attendee shortcuts, explicit consent history/withdrawal, profile management and manual checkout reuse. Identity contacts and accepted orders are unchanged. Browser/checkout/accessibility acceptance, production consent policy, retention/export/deletion integration, key rotation and broader platform phases remain open. See progress.md and runbooks/saved-attendees.md.

### Ticket directions progress (0.45.0)
Added scheduled venue directions/address display to the wallet and downloaded HTML tickets, and address-aware calendar exports through the Inventory public contract. Live navigation, offline viewer/browser/print/accessibility acceptance, controlled relocation and broader ticket/payment/privacy workflows remain open. See progress.md and runbooks/ticket-directions.md.

### Inbox read-state progress (0.46.0)
Added unread totals, atomic read updates for displayed notifications and individual unread actions, with owner isolation and later-arrival preservation. Browser/accessibility/load acceptance, live badges, retention, external channels and broader platform phases remain open. See progress.md and runbooks/inbox-actions.md.

### Provider correction progress (0.47.0)
Implemented versioned name corrections, latest feedback and resubmission for organization owners, with draft preservation and current-permission checks. Complete contact/business/documents/payout onboarding, pagination, browser/multi-organization/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/provider-corrections.md.

### Private onboarding progress (0.48.0)
Implemented private business/contact drafts, protected reviewer access, metadata-only auditing, versioned saves and completeness gates on submission/approval. Documents, payout verification, full business eligibility, retention/security, browser/multi-form/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/private-provider-onboarding.md.

### Provider review history progress (0.49.0)
Implemented immutable, atomic review decisions, business-version retry handling, private paginated owner/reviewer history and administrator lookup, plus reviewer rejection controls. Legacy records are not reconstructed without evidence. Full historical application snapshots, under-review assignment, approved retention, browser/reviewer/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/provider-review-history.md.

### Provider queue progress (0.50.0)
Implemented stable provider queue pagination, provider-type filters and URL-based admin navigation beyond the prior 100-record ceiling. Partial indexes support submitted-state ordering. The queue remains live rather than a frozen snapshot. Listing queue pagination, browser/navigation/scroll/accessibility and load acceptance, and broader platform phases remain open. See progress.md and runbooks/provider-review-queue.md.

### Listing queue progress (0.51.0)
Implemented paginated listing reviews beyond 100 submissions, movie/event/sports filters, a dedicated /admin/listings page and inline versioned decision/reason forms. The admin interface no longer consumes the capped aggregate queue. Browser/navigation/scroll/accessibility, unsaved-reason protection, load acceptance, listing decision replay and broader platform phases remain open. See progress.md and runbooks/listing-review-queue.md.

### Listing decision retry progress (0.52.0)
Implemented immutable listing decisions, reviewer attribution, atomic persistence and same-reviewer business-version replay, plus an original-payload retry action in the review form. Current moderation checks apply even to replays, which never mutate current listing state. Full history UI, approved retention, browser/retry/accessibility and unsaved-navigation acceptance and broader platform phases remain open. See progress.md and runbooks/listing-review-retries.md.

### Listing decision history progress (0.53.0)
Implemented audited, paginated decision-history APIs and pages for current organization members and moderators, with editor/queue links and separate reviewer identity projection. The existing durable decisions table supplies history without a new migration. Earlier moderation records and ordinary draft revisions, retention approval, browser/navigation/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/listing-review-history.md.

### Saved listing revision progress (0.54.0)
Implemented protected, audited revision APIs and member/moderator panels exposing retained pre-change core content and legacy reasons, with exact bigint pagination and immutable storage. Category metadata history, structured comparison/restore, approved retention, browser/navigation/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/listing-revisions.md.

### Revision comparison progress (0.55.0)
Implemented protected, audited same-listing comparison APIs and From/To selection across history pages, with side-by-side changed core fields and exact references. Category-specific history/comparison, restore policy, browser/paging/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/revision-comparison.md.

### Category revision history progress (0.56.0)
Implemented safe movie/event/sports metadata projection in revision history/comparisons and labeled frontend values. Coverage is limited to fields retained in listing snapshots. Unsupported category-detail capture, restore policy, retention approval, browser/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/category-revision-history.md.

### Additional category retention progress (0.57.0)
Implemented future retention of additional supplied category content through public contracts, with history/comparison labels and compatible retry fingerprints. Prior snapshots remain unchanged. Missing historical values, media history, retention/restore policy, browser/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/category-history-capture.md.

### Listing submission recovery progress (0.58.0)
Implemented immutable submission results, original-actor business-version replay and frontend original-submission recovery while preserving later state and current membership checks. Legacy submissions, generic draft-save replay, retention approval, browser/retry/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/listing-submission-retries.md.

### Generic draft recovery progress (0.59.0)
Implemented durable normalized generic edit replay, original-actor/current-membership checks and original-payload frontend recovery retaining current form edits. Legacy edits, generic creation retries, retention approval, browser/form/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/generic-draft-retries.md.

### Generic creation recovery progress (0.60.0)
Implemented required actor/organization-scoped creation keys, immutable atomic mappings and frontend original-creation recovery with save-time form protection. Old unkeyed commands, browser-close attempt persistence, approved retention, browser/recovery/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/generic-listing-creation.md.

### Organization creation recovery progress (0.61.0)
Implemented actor-scoped creation keys, immutable atomic organization/owner/result mappings, current active-account/ownership checks and frontend original-request recovery. Old unkeyed commands, reload persistence, approved retention, browser/recovery/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/organization-creation.md.

### Provider submission recovery progress (0.62.0)
Implemented immutable original submission results, atomic state/result persistence, original-actor/current-owner replay and frontend original-submission recovery without reverting later review state. Legacy reconstruction, reload persistence, approved retention, browser/recovery/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/provider-submission-retries.md.

### Organization draft recovery progress (0.63.0)
Implemented durable normalized name-edit results, atomic name/version/result persistence, original-actor/current-owner replay and frontend original-save recovery preserving different entered text. Private onboarding save recovery, legacy reconstruction, reload persistence, approved retention, browser/form/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/provider-draft-retries.md.

### Private onboarding save recovery progress (0.64.0)
Implemented immutable save fingerprints, atomic private details/version/audit persistence, audited original-actor/current-owner replay and frontend recovery preserving different entered details. Legacy reconstruction, reload persistence, approved retention, browser/session/form/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/onboarding-save-retries.md.

### Owner invitation pagination progress (0.65.0)
Implemented exact timestamp/UUID owner invitation pages, indexed ordering, current ownership/MFA protection and First/Previous/Next controls beyond the former 100-record ceiling. Recipient inbox/member pagination, invitation resend delivery, browser/accessibility/load acceptance and broader platform phases remain open. See progress.md and runbooks/provider-invitation-pages.md.

### Recipient invitation pagination progress (0.66.0)
Implemented authenticated-contact invitation pages with exact cursors, current pending/expiry filtering and First/Previous/Next navigation beyond the former 100-item ceiling. Member pagination, invitation delivery/resend, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/recipient-invitation-pages.md.

### Exact membership version progress (0.67.0)
Implemented exact bigint-string role/revocation versions with bounded validation and safe-number compatibility. Member pagination, invitation delivery/resend, browser/accessibility acceptance and broader platform phases remain open. See progress.md and runbooks/membership-versions.md.

### Member pagination progress (0.68.0)
Implemented independent bounded member/invitation pages, current owner/MFA protection and separate frontend navigation retaining role/revocation actions. Invitation delivery/resend, browser/accessibility/load acceptance and broader platform phases remain open. See progress.md and runbooks/member-pages.md.

### Invitation revocation recovery progress (0.69.0)
Implemented atomic revocation records/audit, original-actor/version replay with current owner/MFA checks, and original-request frontend recovery. Legacy reconstruction, membership action replay, reload persistence, retention, browser/accessibility and broader phases remain open. See progress.md and runbooks/invitation-revocation-retries.md.

### Membership action recovery progress (0.70.0)
Implemented durable original-actor/action replay, atomic membership/audit persistence and frontend recovery preserving later roles and replacement memberships. Legacy reconstruction, reload persistence, retention, browser/accessibility and broader phases remain open. See progress.md and runbooks/membership-action-recovery.md.

### Invitation status filter progress (0.71.0)
Implemented owner effective-status filtering with authoritative expiry classification, paginated results and frontend selection preserving member position. Invitation delivery/resend, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/invitation-status-filters.md.

### Member role filter progress (0.72.0)
Implemented owner member-role filtering before pagination and frontend selection preserving invitation filters/position. Invitation delivery/resend, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/member-role-filters.md.

### Customer consent history progress (0.73.0)
Implemented owner-scoped marketing consent history, immutable records, version pagination and an explicit-load customer panel distinguishing consent from communication delivery. Historical policy text, retention/deletion handling, browser/session/accessibility, external delivery and broader phases remain open. See progress.md and runbooks/marketing-consent-history.md.

### Saved attendee consent history progress (0.74.0)
Implemented owner-scoped immutable consent metadata history, version pagination and a customer panel excluding all attendee details, including after withdrawal. Historical policy text, retention/deletion handling, browser/session/accessibility and broader phases remain open. See progress.md and runbooks/attendee-consent-history.md.

### Consent wording retention progress (0.75.0)
Implemented immutable wording snapshots for new consent entries, shared versioned form text and explicit legacy-unavailable display. Legacy reconstruction, retention/deletion handling, future-version rollout, browser/accessibility and broader phases remain open. See progress.md and runbooks/retained-consent-wording.md.

### Notification category progress (0.76.0)
Implemented domain-defined category filtering combined with unread cursor pagination, owner isolation and frontend selection. External delivery, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/notification-categories.md.

### Notification read-status progress (0.77.0)
Implemented all/unread/read views with category pagination and legacy unread compatibility. External delivery, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/notification-read-filters.md.

### Bulk unread notification progress (0.78.0)
Implemented atomic bounded owner-scoped mark-unread and frontend displayed-page selection. External delivery, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/bulk-unread-notifications.md.

### Notification date-range progress (0.79.0)
Implemented inclusive India event-date ranges, combined server-side filtering and frontend apply/clear controls. External delivery, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/notification-date-ranges.md.

### Favorites recovery progress (0.80.0)
Implemented account/resource request invalidation, resource-bound sign-in save intent, list retry states and exact retrieval/state API contracts. Artist/team favorites, browser/sign-in/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/favorites-recovery.md.

### Searchable help progress (0.81.0)
Implemented public FAQ keyword/topic search, six versioned code-managed answers, searchable Help UI and contextual booking/payment links. Administrative FAQ editing/publication, localization, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/help-search.md.

### Help administration progress (0.82.0)
Implemented protected editing/publication of existing FAQ articles, preview, conflict/retry recovery, immutable receipts, audit and PostgreSQL public retrieval. New article creation, history browsing, draft/approval workflows, retention, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/help-administration.md.

### FAQ history progress (0.83.0)
Implemented audited staff revision-history retrieval, prior-content projection, version pagination and an explicit-load panel preserving editor drafts. Creation, comparison/restore, retention, browser/accessibility/load acceptance and broader phases remain open. See progress.md and runbooks/help-revision-history.md.

### FAQ creation progress (0.84.0)
Implemented protected unpublished draft creation, internal destinations, unique article IDs, immutable retry receipts, audit and preview/recovery UI. Deletion, destination editing, creation-history display, approval, retention, pagination/load, browser/accessibility acceptance and broader phases remain open. See progress.md and runbooks/help-draft-creation.md.

### FAQ list progress (0.85.0)
Implemented bounded administration pages, ID/question search, publication filters and frontend list navigation that preserves active drafts. Public-search pagination, indexing/load, browser/accessibility acceptance and broader phases remain open. See progress.md and runbooks/help-administration-list.md.
