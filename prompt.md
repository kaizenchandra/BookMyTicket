
Act as the principal software architect, full-stack implementation engineer, UI/UX designer, and quality engineer responsible for delivering a complete ticket booking platform.

Your task is to PLAN, DESIGN, IMPLEMENT, INTEGRATE, TEST, DEPLOY, and VERIFY an end-to-end application for booking movies, events, and sports.

Work in the available repository and execution environment. Deliver functioning software and verifiable evidence. Continue beyond planning, scaffolding, visual prototypes, and individual demonstration flows.

1. PRODUCT OBJECTIVE

Deliver six complete experiences:
1. Customer application.
2. Cinema partner portal.
3. Event and sports organizer portal.
4. Platform administration console.
5. Support and finance console.
6. Admission/scanner application.

Initial market: India.
Initial currency: INR.
Preserve venue-local time zones.

Mandatory architecture:
MODULAR MONOLITH using CLEAN ARCHITECTURE and HEXAGONAL PORTS AND ADAPTERS.

Mandatory payment integration:
Razorpay, supporting UPI, credit cards, and debit cards when supported and enabled for the merchant account.

Mandatory appearance:
A high-fidelity reproduction of the observed BookMyShow customer interface and booking interaction patterns, with exactly two themes: LIGHT and DARK.

Reference:
https://in.bookmyshow.com/explore/

2. INPUTS, PRECEDENCE, AND REQUIREMENT COVERAGE

Read the complete uploaded implementation prompt and all available frontend/backend specifications before implementation.

Apply this precedence within the project requirements:
1. Explicit decisions in this final prompt.
2. Detailed frontend and backend specifications.
3. Earlier implementation prompts.
4. Documented assumptions.

This prompt supersedes earlier microservices requirements. Provider and payment capabilities must be isolated internal modules within the modular monolith.

Detailed specifications remain mandatory acceptance scope. Summaries in this prompt do not replace their individual requirements.

Preserve source IDs and namespace overlapping identifiers:
- FE:<original-id>
- BE:<original-id>
- BASE:<original-id>
- GAP:<new-id>

Create a traceability register containing:
Requirement, source, role, journey, frontend route, backend module, API/use case, data ownership, permissions, transaction rules, acceptance tests, implementation status, verification evidence, and dependencies.

Break compound requirements into testable subrequirements.

Identify missing behavior, conflicting requirements, ambiguous policies, and missing dependencies. Record resolutions. Do not silently drop scope or choose whichever interpretation is easiest.

If a referenced attachment is unavailable, identify it explicitly. Continue work supported by available requirements without claiming full attachment coverage.

3. WORKING RULES

Inspect repository instructions, code, dependencies, tests, infrastructure, and integrations first.

Preserve useful existing work. For a new repository, select a coherent maintained stack and explain significant choices. Prefer PostgreSQL for authoritative transactional data unless a justified existing alternative applies.

Use current official documentation. Pin dependencies and maintain reproducible builds.

Make reversible implementation decisions autonomously. Ask only for information or authorization that materially blocks progress. Continue unaffected work while blocked dependencies are resolved.

Do not fabricate:
- Production listings, availability, customers, reviews, revenue, or analytics.
- OTP delivery, provider connectivity, payments, refunds, payouts, or admissions.
- Successful tests, performance measurements, compliance, or deployed URLs.

Do not implement fake business APIs, hardcoded payment success, placeholder dashboards, or in-memory production persistence.

Clearly labeled test fixtures in isolated test databases are permitted. Integration tests must exercise real application components and infrastructure.

Do not silently treat provider Test Mode as satisfying the no-simulation requirement. If necessary, request a specific exception and label its evidence separately from live verification.

Use secure secret configuration. Never commit credentials or place them in browser bundles, logs, screenshots, or ordinary documentation.

Respect existing authorization. Request only missing authorization for uncovered live charges, refunds, payouts, destructive operations, or infrastructure spending.

4. PLANNING AND DESIGN BEFORE CODING

Produce concise, actionable artifacts:
- Repository assessment.
- Requirement coverage and gap analysis.
- Personas, user journeys, route map, and screen inventory.
- Reference UI audit and design-system specification.
- System context, module, and deployment diagrams.
- Entity model, ownership map, and integrity constraints.
- API contracts and internal event schemas.
- State machines and transition rules.
- Transaction boundaries and concurrency design.
- Threat model and authorization matrix.
- External dependency and business-policy register.
- Six-pillar architecture assessment.
- Test strategy and proposed service objectives.
- Implementation sequence, deployment plan, and recovery plan.

Record important tradeoffs in short architecture decision records.

Distinguish confirmed decisions, proposed defaults, reversible assumptions, and production blockers.

Begin development once the initial design is coherent. Do not wait for routine design approval or spend the entire task producing documentation.

5. MODULAR MONOLITH DESIGN

Use one versioned backend application with horizontally scalable instances.

Background workers may run as separate processes from the same application artifact. Internal modules communicate through in-process contracts, not internal HTTP microservices.

Organize each module into:
- Domain: entities, value objects, invariants, policies, and domain events.
- Application: commands, queries, use cases, orchestration, and ports.
- Adapters: HTTP, persistence, payment, storage, messaging, and notifications.
- Public contracts: supported interfaces and data-transfer objects.

Enforce:
- Domain code does not depend on frameworks, ORM implementations, SDKs, or UI.
- Controllers translate transport input and invoke application use cases.
- Business rules do not live in controllers or frontend components.
- Modules cannot import private repositories or directly mutate another module’s tables.
- Cross-module operations use explicit application interfaces.
- Shared code remains small.
- Circular dependencies are prohibited.
- Architecture checks enforce these boundaries.

Use explicit local units of work for cross-module changes that must commit atomically in the same database.

Use transactional outbox/inbox processing for durable side effects and projections where appropriate.

Avoid unnecessary distributed systems complexity, generic abstractions, and event sourcing unless a concrete requirement justifies them.

6. REQUIRED MODULES

Implement separate internal modules for:
1. Identity and Access.
2. Customer Profiles.
3. Provider Management.
4. Cinema Operations.
5. Event Operations.
6. Sports Operations.
7. Venues and Seating.
8. Catalog and Discovery.
9. Inventory and Reservations.
10. Pricing and Promotions.
11. Checkout and Bookings.
12. Payments.
13. Ticketing and Admission.
14. Notifications.
15. Finance and Settlements.
16. Support and Administration.
17. Reporting and Audit.

Assign exactly one authoritative owner for each entity and business invariant.

Inventory and Reservations owns all platform-managed seat and capacity allocation. Provider modules must not maintain competing availability counters.

Separate transactional truth from search, analytics, and reporting projections.

7. CUSTOMER FRONTEND SCOPE

Implement all detailed requirements, including:

Navigation and identity:
- Responsive navigation, protected routes, deep links, browser history, and safe authentication return paths.
- City selection with manual fallback.
- OTP authentication, session recovery, profile management, and preferences.
- Favorites, notification preferences, and account data requests.

Discovery:
- Movies, Events, and Sports.
- Search suggestions, grouped results, filters, sorting, and pagination.
- Shareable filter state and restored browsing context.
- Now Showing, Coming Soon, curated collections, and venue pages.

Movies:
- Details, trailers, cast, certification, language, format, and duration.
- Date/cinema/showtime selection.
- Seat selection, accessible alternatives, and optional food/beverages.

Events:
- Performers, sessions, venues, restrictions, and ticket categories.
- General admission, assigned seating, packages, and multi-day passes.
- Versioned attendee forms and authorized online-event access.

Sports:
- Sports, teams, competitions, fixtures, stadium blocks, gates, and hospitality.
- Single-fixture and multi-fixture passes.
- Participant registration and credential collection where applicable.

Commerce:
- Reservation countdowns.
- Buyer and attendee details.
- Add-ons, coupons, itemized pricing, and policy acknowledgment.
- Razorpay checkout and uncertain-payment recovery.
- Confirmation, ticket access, booking history, and reminders.
- Cancellation previews, partial cancellations, refunds, transfers, and exchanges where permitted.

Engagement:
- Reviews and moderation.
- Availability alerts and waitlists.
- Calendar export and support cases.

Every visible business action must connect to its real backend behavior.

8. PROVIDER, ADMIN, FINANCE, AND SCANNER SCOPE

Provider experiences:
- Resumable onboarding and review status.
- Organization switching, invitations, and scoped roles.
- Catalog drafts, preview, moderation, and publishing.
- Venues, versioned seating plans, schedules, pricing, and allocations.
- Event forms, packages, fixtures, and passes.
- Bulk imports with preview and per-record outcomes.
- Disruptions, attendee lists, reporting, and settlement statements.

Administration:
- Provider/listing approval and moderation.
- Master data, promotions, content, and policy configuration.
- Booking investigation and audited operational actions.
- Bulk disruption workflows and background-operation visibility.
- Searchable audit history.

Support and finance:
- Case assignment, escalation, internal notes, and customer replies.
- Payment/refund timelines and reconciliation exceptions.
- Controlled refund approvals.
- Ledger views, commissions, provider liabilities, settlements, payouts, and disputes.

Admission:
- Staff authentication and occurrence/gate assignment.
- Camera scanning and authorized manual lookup.
- Server-verified admission.
- Distinct invalid, duplicate, wrong-event, expired, revoked, and transferred outcomes.
- Re-entry, pass entitlements, and authorized exceptions.

Do not present offline ticket display as offline admission verification. Fully offline scanners cannot be claimed to guarantee cross-device duplicate-entry prevention.

9. BOOKMYSHOW UI/UX FIDELITY

The customer interface should look and behave as closely as possible to the observed reference.

Before implementation, inspect accessible reference pages using browser tools. Record city, date, viewport, screenshots, measurements, and observed interactions.

Match:
- Header composition, search placement, location selector, and account controls.
- Category navigation and content hierarchy.
- Container widths, gutters, spacing, and alignment.
- Typography, card dimensions, poster proportions, and metadata density.
- Banners, collections, filters, and navigation controls.
- Movie/event/sports detail layouts.
- Date selection, cinema listings, and showtime controls.
- Seat-map composition, booking summary, and checkout progression.
- Mobile layouts and interactions.

Do not replace the reference with a generic dashboard or unrelated visual style.

Use configured platform branding and legitimately available media. Do not imply the application is the official BookMyShow service.

If a reference screen cannot be inspected, identify the design as inferred. Do not claim exact fidelity without evidence.

Treat Dark mode as a deliberate adaptation of the observed interface where the reference does not expose it.

Extend the design system into provider and operational screens.

Make the experience immersive, elegant, innovative, neat, and clean through:
- Strong visual hierarchy.
- Useful imagery.
- Consistent components.
- Restrained motion.
- Clear primary actions.
- Minimal visual noise.
- Helpful feedback and recovery.

Functional clarity, accessibility, and reference fidelity take priority over decorative effects.

10. LIGHT AND DARK THEMES ONLY

Provide exactly two selectable themes: Light and Dark. Do not expose Auto/System or additional themes.

Default to Light unless explicit product configuration specifies Dark.

Persist explicit preference and define deterministic precedence between account and local settings.

Use semantic tokens for surfaces, text, borders, actions, focus, status colors, overlays, shadows, charts, and seat states.

Apply themes to every persona and state:
Forms, tables, dialogs, drawers, tooltips, seat maps, scanner results, empty states, loading states, and errors.

Prevent initial theme flashes and hydration inconsistencies.

Theme changes must not reset forms, selections, checkout, or reservation state.

Use supported styling controls for external checkout and document limitations.

11. ACCESSIBILITY AND FRONTEND RELIABILITY

Target WCAG 2.2 AA.

Support:
- Keyboard navigation and visible focus.
- Semantic headings, labels, landmarks, and useful alternative text.
- Appropriate modal focus management.
- Accessible seat-selection alternatives.
- Reduced motion, text enlargement, and reflow.
- Touch-friendly controls.
- Status indicators that do not rely only on color.
- Controlled announcements for asynchronous outcomes.

Verify representative widths:
360, 390, 768, 1024, and 1440 pixels.

Every applicable screen must handle:
Loading, background refresh, empty, validation, authentication required, forbidden, not found, conflict, expired, rate-limited, offline, partial success, pending, failed, and success.

Never optimistically confirm payment, booking, cancellation, refund, or admission.

Partition frontend caches by identity and organization. Clear private state when switching accounts or organizations.

Keep search/filter state shareable, but keep ticket tokens and sensitive data out of public URLs and analytics.

12. BACKEND FUNCTIONAL COMPLETENESS

Implement the detailed backend specification, including:
- Identity, sessions, OTP controls, privileged MFA, and account lifecycle.
- Tenant, role, resource, venue, and occurrence authorization.
- Provider approval and organization management.
- Catalog revisions, publication, and moderation.
- Versioned seating and occurrence configuration.
- Scheduling conflicts, sales windows, and time-zone handling.
- Search projections and rebuilds.
- Reservations, shared capacity, allocations, packages, and passes.
- Pricing, fees, taxes, promotion budgets, and immutable quotes.
- Orders, bookings, policy acceptance, and attendee validation.
- Payments, refunds, disputes, and reconciliation.
- Ticket issuance, transfer, revocation, and admission.
- Notifications, reminders, and delivery records.
- Ledger, commissions, provider liabilities, and payouts.
- Support, imports, exports, reporting, and audit.
- Retention-aware data export/deletion.
- Reliable jobs and recovery.

Provide versioned API contracts, structured errors, safe pagination, concurrency versions, server time, status freshness, and allowed-action explanations.

Frontend permissions and allowed-action hints never replace backend authorization at execution time.

13. DOUBLE-BOOKING PREVENTION

Correctness must hold across concurrent users, multiple application instances, retries, process crashes, and delayed workers.

Assigned seats:
- Use a unique occurrence-seat identity.
- Store current ownership separately from reservation history.
- Reserve all requested seats atomically.
- Use row locks or conditional updates with verified affected-row counts.
- Acquire locks consistently.
- Reject the entire selection if any required seat is unavailable.
- Validate owner, reservation identity, version, expiry, sales window, and occurrence state inside the protected operation.

General admission:
- Enforce valid held units plus sold units not exceeding sellable capacity.
- Explicitly model shared pools across categories, packages, allocations, and sales channels.
- Include complimentary allocations in capacity enforcement.

Passes:
- Model all covered occurrences and admission entitlements.
- Acquire required platform-managed capacity atomically.
- Do not partially fulfill a package without an explicit supported policy.

Reservation expiry:
- Use authoritative server/database time.
- Check expiry during consumption even when cleanup has not run.
- Do not extend holds on refresh or retry.
- Protect new reservations from stale expiry/release jobs using ownership/version checks.

Confirmation:
- Validate payment state, amount, currency, and trusted order association.
- Atomically consume inventory, confirm the booking, and persist durable fulfillment work.
- Do not hold database transactions open during external API calls.

Use bounded retries for retryable database conflicts.

Caches, queues, search indexes, and UI state must never authorize a sale.

14. PAYMENTS, REFUNDS, AND FINANCIAL CONSISTENCY

Integrate Razorpay through a concrete adapter behind a payment port.

Verify current official integration requirements before coding.

Implement:
- Server-created provider orders.
- Trusted identifier mapping.
- Server-calculated amounts.
- Checkout signature verification.
- Raw-body webhook signature verification.
- Durable webhook ingestion and deduplication.
- Out-of-order and delayed event handling.
- Authorization/capture distinction.
- Provider queries and periodic reconciliation.
- Unknown-outcome and late-success recovery.
- Full/partial refunds and refund reconciliation.
- Duplicate successful charge detection.
- Dispute and chargeback workflows.

A browser callback is not proof of completed booking.

If payment succeeds after expiry, follow the documented inventory reacquisition policy. If inventory cannot be secured, record the refund obligation and execute the permitted recovery process. Never displace another customer.

Serialize concurrent refund commitments so completed and in-flight refunds cannot exceed eligible captured funds.

Keep payment, refund, booking, ticket, and admission states separate.

Do not collect or store raw card details or CVV.

Distinguish customer collection, merchant settlement, provider liability, and provider payout. Verify marketplace/payout eligibility separately.

Maintain balanced immutable financial entries with compensating corrections. Mark payouts paid only from authoritative evidence.

15. DURABLE WORKFLOWS AND IDEMPOTENCY

For retry-sensitive commands:
- Scope keys by actor/tenant and operation.
- Store request fingerprints.
- Reject reuse with changed input.
- Return the original outcome or retrievable in-progress operation.
- Preserve business uniqueness after idempotency-record expiry.

For each state transition document:
Actor, permissions, preconditions, transaction boundary, inventory/financial effect, event output, retry behavior, and recovery.

Use at-least-once processing with deduplicated consumers.

Implement durable outbox processing, worker leases, stale-worker protection, bounded retries, dead letters, and authorized replay.

Persist critical work before reporting success.

Do not allow replayed payment events to resurrect cancelled bookings.

Serialize cancellation, transfer, admission, occurrence disruption, and confirmation according to explicit policy.

16. SECURITY, BUSINESS POLICIES, AND DEPENDENCIES

Implement least privilege, secure sessions, tenant isolation, secret management, appropriate CSRF/CORS controls, secure uploads, safe rich content, restricted downloads, and audit trails.

Enforce authorization on exports, queued jobs, signed downloads, and real-time subscriptions.

Prevent operational overrides from bypassing inventory or financial invariants.

Maintain versioned configuration for:
Hold duration, purchase limits, cancellation rules, taxes/fees, transfers, re-entry, commissions, settlement timing, retention, and notification channels.

Use labeled development defaults where needed. Do not activate production commercial behavior with unresolved material policies.

Distinguish platform-managed inventory from externally authoritative supplier stock. Real external inventory requires supplier reservation, confirmation, cancellation, and reconciliation support.

When dependencies are unavailable:
Implement the real adapter boundary and configuration checks, expose a truthful unavailable state, record the blocker, and continue independent work.

17. SIX WELL-ARCHITECTED PILLARS

Apply and verify all six AWS Well-Architected pillars:

Operational Excellence:
CI/CD, infrastructure as code, logs, metrics, traces, runbooks, and incident response.

Security:
Identity, access control, tenant isolation, protected data, secrets, and audit.

Reliability:
Transactional invariants, durable processing, reconciliation, backups, restoration, and rollback.

Performance Efficiency:
Measured API/query performance, indexing, pagination, appropriate caching, media delivery, and concurrency testing.

Cost Optimization:
Resource sizing, budgets, cost visibility, storage lifecycle, and justified dependencies.

Sustainability:
Efficient processing, reduced idle resources, bounded retention, and minimized redundant work.

Define measurable SLOs, latency/throughput targets, RPO, and RTO. Separate proposed targets from verified results.

18. IMPLEMENTATION AND TESTING SEQUENCE

Deliver integrated vertical slices:
1. Foundation, module boundaries, identity, authorization, and design system.
2. Provider onboarding, venues, seating, catalog, and publication.
3. Customer discovery and category journeys.
4. Inventory, reservations, pricing, and checkout.
5. Razorpay, confirmation, ledger, and reconciliation.
6. Tickets, admission, transfers, cancellations, and refunds.
7. Provider/admin/support/finance operations.
8. Required enhancements and operational recovery.
9. Deployment and complete acceptance verification.

Each slice includes migrations, domain logic, API, frontend, permissions, tests, documentation, and traceability.

Run:
- Domain and integration tests.
- Architecture boundary checks.
- API/event contract checks.
- Tenant-isolation and authorization tests.
- Browser tests for all six experiences.
- Accessibility and visual regression checks.
- Migration, concurrency, load, restart, restore, and rollback tests.

Mandatory scenarios:
- Many simultaneous requests for one seat.
- All-or-nothing multi-seat requests.
- Shared-capacity exhaustion.
- Stale expiry jobs.
- Late payment success and browser closure.
- Duplicate/out-of-order webhooks.
- Multiple captured attempts.
- Concurrent partial refunds.
- Refund/payout timeout recovery.
- Cancellation versus admission.
- Transfer versus scanning.
- Simultaneous gate scans.
- Lost responses followed by retries.
- Occurrence cancellation versus confirmation.
- Permission revocation during exports.
- Cross-tenant attempts.
- Notification failure.
- Stale caches/search results.
- Theme switching during checkout.

Record commands, environment, actual results, screenshots where relevant, and limitations. Skipped or blocked verification is not a passing result.

19. DEPLOYMENT AND HANDOFF

Provide:
- Reproducible builds and containers.
- Local setup using real dependencies.
- Separate development, staging, and production configuration.
- Infrastructure as code.
- CI/CD quality/security gates.
- Managed secrets.
- HTTPS, domains, and webhook routing.
- Safe database migrations.
- Health/readiness checks and graceful shutdown.
- Durable workers and observable queues.
- Backup, recovery, rollback, and reconciliation runbooks.
- Resource limits, scaling rules, and cost controls.

Deploy within the authorized environment and verify deployed behavior.

Infrastructure files are not proof of deployment. Payment Test Mode is not proof of live payment processing.

Track implementation and verification separately.

Deliver source code, migrations, API/event contracts, architecture documentation, UI evidence, tests, deployment configuration, operational documentation, requirement coverage, verified URLs, and explicit blockers.

A feature is complete only when its required frontend, backend, permissions, error handling, and acceptance tests are implemented and verified to the claimed environment level.

Do not silently reduce scope to an MVP or leave required features permanently disabled.

Persist progress and next steps so work can resume without losing decisions.

START NOW:
Read all available requirements, inspect the repository, identify conflicts and gaps, establish the architecture and reference UI baseline, present a concise execution sequence, and proceed directly into implementation.
=