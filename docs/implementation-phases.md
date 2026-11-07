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
