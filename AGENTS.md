## Purpose and scope

Build and maintain a movie, event, and sports ticket booking platform for India, initially using INR. Support customers, cinema partners, event/sports organizers, administrators, support/finance staff, and gate staff.

These are durable repository instructions, not authorization to start every roadmap item. Complete the user's current task and its necessary dependencies. For an end-to-end implementation request, continue through design, coding, integration, testing, and authorized deployment; do not stop at scaffolding.

Follow higher-priority instructions and the user's latest explicit decisions. Read applicable nested agent instructions before changing files. Preserve unrelated user work and do not overwrite existing changes blindly.

## First steps and source of truth

1. Inspect the repository, working-tree changes, README, manifests, lockfiles, CI configuration, and available requirements.
2. Read the detailed frontend/backend specifications and final implementation brief. Do not assume attachments from another chat are available in this repository.
3. Locate existing documentation before creating replacements. If absent, use these proposed locations when documenting implementation:
    - `docs/requirements/frontend.md`
    - `docs/requirements/backend.md`
    - `docs/requirements/traceability.md`
    - `docs/architecture/` for diagrams, ownership, state machines, and decisions
    - `docs/development.md` for verified setup and commands
    - `docs/runbooks/` for deployment, recovery, and reconciliation
    - `docs/progress.md` for decisions, blockers, evidence, and next steps
4. These paths are conventions, not claims that files already exist. Identify missing specifications and continue independent work; never claim coverage of unread or unavailable documents.

Preserve requirement IDs. Namespace collisions as `FE:<id>`, `BE:<id>`, and `BASE:<id>`; assign `GAP:<id>` to additions. Trace requirements to role, route, module, use case, permissions, transaction rules, tests, and evidence. Summaries do not replace detailed requirements. Do not silently discard requirements or hide incomplete work behind permanently disabled flags.

## Commands and working method

The stack and commands are not established by this file. Discover them from actual manifests, scripts, CI, and repository documentation. Do not invent commands or claim they ran.

- Use the package manager indicated by the lockfile. Preserve reproducible dependency resolution.
- Prefer `rg` for file and text searches. Read targeted files rather than dumping the repository.
- Document verified install, development, lint, type-check, build, migration, unit, integration, and browser-test commands in `docs/development.md` once established.
- Use current official documentation for changing framework and integration behavior.
- Plan substantial changes briefly, then implement. Make routine reversible decisions autonomously.
- Keep changes focused. Do not perform unrelated rewrites, destructive cleanup, history rewriting, or broad dependency upgrades.
- Ask only for material missing information or uncovered authorization. Continue unaffected work while blocked.

## Architecture: mandatory modular monolith

Use Clean Architecture with Hexagonal ports and adapters inside a modular monolith. Cinema, organizer, and payment services are internal modules, not independent microservices.

Use one versioned backend application with horizontally scalable instances. Workers may run separately from the same artifact. Prefer PostgreSQL for authoritative transactional data unless an existing justified alternative applies.

Each module separates:
- Domain: entities, value objects, invariants, policies, and domain events.
- Application: commands, queries, use cases, orchestration, ports, and transaction boundaries.
- Adapters: HTTP, persistence, payment, storage, notifications, and messaging.
- Public contracts: supported interfaces and DTOs.

Dependency rules:
- Domain code must not import HTTP frameworks, ORM implementations, SDKs, or UI code.
- Controllers validate/translate transport data and invoke application use cases.
- Business rules belong in domain/application code, not controllers or UI components.
- Modules communicate through explicit in-process contracts. Do not import another module's private repositories or mutate its tables directly.
- Keep shared code small; prevent circular dependencies with automated checks.
- Use an explicit local unit of work through application ports when cross-module changes must commit atomically.
- Use transactional outbox/inbox processing for durable side effects where appropriate. Do not add internal network hops or unnecessary distributed transactions.

Required ownership areas: Identity and Access; Customer Profiles; Provider Management; Cinema Operations; Event Operations; Sports Operations; Venues and Seating; Catalog and Discovery; Inventory and Reservations; Pricing and Promotions; Checkout and Bookings; Payments; Ticketing and Admission; Notifications; Finance and Settlements; Support and Administration; Reporting and Audit.

Assign one authoritative owner per entity/invariant. Inventory owns platform-managed seat/capacity allocation. Search, caches, and reporting are rebuildable projections, never sale authority.

## Booking correctness: release-blocking invariants

- Maintain a unique occurrence-seat identity and separate current ownership from reservation history.
- Reserve all requested seats atomically using database locks or checked conditional updates. An unprotected read-then-write is unacceptable.
- Acquire locks in deterministic order; roll back the whole selection if any required seat is unavailable.
- Enforce valid held units plus sold units not exceeding sellable capacity. Model capacity shared across categories, allocations, packages, passes, and channels.
- Include complimentary tickets and all package entitlements in capacity enforcement.
- Use authoritative server/database time. Validate expiry during consumption even if cleanup has not run.
- Refreshes and identical retries must not extend holds. Extensions require explicit bounded policy.
- Bind release, expiry, and consumption to reservation identity/version so stale workers cannot modify a newer hold.
- Validate ownership, occurrence/sales state, purchase limits, and inventory within the protected operation.
- Atomically consume inventory, confirm the booking, and persist durable fulfillment work.
- Never hold a database transaction open during external network calls.
- Handle late captured payments through documented inventory reacquisition or refund recovery; never displace another customer.
- Serialize confirmation, cancellation, transfer, admission, and occurrence disruption according to explicit policy.
- Online single-entry admission must be atomic across scanners. Offline ticket display is not offline admission verification.

Keep reservation, booking, payment attempt, refund, ticket validity, admission entitlement, transfer, and payout states separate. Define preconditions, actors, effects, retries, and recovery for transitions.

## Idempotency and background work

Scope idempotency keys by actor/tenant and operation; store request fingerprints and reject changed payloads under the same key. Return the original result or retrievable in-progress operation for retries. Preserve business uniqueness after key retention expires.

Assume at-least-once asynchronous delivery. Implement deduplicated consumers, durable work records, bounded retries, backoff, leases, stale-worker protection, dead-letter handling, and authorized replay. Delayed work must revalidate current business state. Replayed payment events must not resurrect cancelled bookings.

## Razorpay and finance

Use a real Razorpay adapter behind a payment port. Verify current official API requirements, enabled payment methods, and merchant eligibility. Support UPI and credit/debit cards where available.

- Create orders server-side with trusted amount, currency, and internal/provider mapping.
- Verify checkout signatures and raw-body webhook signatures. Persist accepted webhook events before acknowledging success.
- Handle duplicates, out-of-order events, unknown outcomes, authorization versus capture, and periodic reconciliation.
- A browser success callback does not confirm a booking.