# makmyticket-Style Admin Panel — Functional Requirements Specification (FRS)

Scope: Travel booking platform administration covering Flights, Hotels, Holiday Packages, Buses, Trains, Cabs, Payments, Customers, Partners, Bookings, Refunds, Promotions, and Business Operations.

This is a proposed enterprise-grade functional specification for building a makmyticket-style travel platform, not a claim about makmyticket's private internal admin functionality. Public information confirms that makmyticket supports travel-agent booking through myPartner and hotel-partner inventory, pricing, and content management through its partner ecosystem.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.sec.gov\&sz=32)

sec.gov+2



## 1. Admin panel modules overview

The following catalogue defines 24 modules with separate frontend and backend responsibilities.

Functional requirement coverage

24 modules

AllMVP (P0)Phase 2 (P1)

24 modules

01

Authentication & Authorization

P0

02

Admin Dashboard & Analytics

P0

03

Admin Users, Roles & Permissions

P0

04

Customer Management

P0

05

Flight Management

P0

06

Hotel & Property Management

P0

07

Room Inventory & Rate Management

P0

08

Bus Booking Management

P1

09

Train Booking Management

P1

10

Cab & Transfer Management

P1

11

Holiday Package Management

P1

12

Centralized Booking Management

P0

13

Payment & Transaction Management

P0

14

Cancellation & Refund Management

P0

15

Offers, Coupons & Promotions

P1

16

Supplier & Partner Management

P0

17

Commission & Settlement Management

P0

18

Customer Support & Disputes

P1

19

Reviews & Ratings Moderation

P1

20

CMS & Marketing Management

P1

21

Notifications & Communication

P0

22

Reports & Business Intelligence

P1

23

Audit Logs & Compliance

P0

24

Platform Configuration & Integrations

P0

P0 = core launch scope; P1 = subsequent release. Priorities are proposed and depend on which travel products launch first.

# 2. Detailed frontend and backend functional requirements

## FR-01: Authentication & Authorization

Frontend functional requirements

- FR-FE-001: Admin login using email/mobile and password or enterprise SSO.
- FR-FE-002: Multi-factor authentication interface.
- FR-FE-003: Password reset and account recovery screens.
- FR-FE-004: Role-based navigation and action visibility.
- FR-FE-005: User profile, password change, session management, and logout.
- FR-FE-006: Session-expiry and unauthorized-access handling.

Backend functional requirements

- FR-BE-001: Authenticate administrators through an identity provider.
- FR-BE-002: Issue and validate secure sessions or tokens.
- FR-BE-003: Enforce RBAC and resource-level authorization on every protected operation.
- FR-BE-004: Support MFA, login throttling, account lockout, and credential recovery.
- FR-BE-005: Revoke sessions when accounts are disabled or permissions change.
- FR-BE-006: Audit authentication and privileged operations.

## FR-02: Admin Dashboard & Analytics

Frontend

- FR-FE-007: Display total bookings, revenue, cancellations, refunds, and active customers.
- FR-FE-008: Display flight, hotel, bus, train, and cab booking summaries.
- FR-FE-009: Date filters: Today, Yesterday, 7 Days, 30 Days, and Custom.
- FR-FE-010: Revenue and booking trend charts.
- FR-FE-011: Pending refunds, supplier failures, and support alerts.
- FR-FE-012: Drill down from KPI cards to filtered records.

Backend

- FR-BE-007: Aggregate booking and financial metrics by date, product, and status.
- FR-BE-008: Provide KPI and timeseries APIs with consistent metric definitions.
- FR-BE-009: Maintain historical aggregates or reporting projections.
- FR-BE-010: Support filtering by geography, supplier, product, and currency.
- FR-BE-011: Exclude or separately represent failed, cancelled, or refunded transactions as appropriate.
- FR-BE-012: Apply data-access authorization to dashboard results.

## FR-03: Admin Users, Roles & Permissions

Frontend

- FR-FE-013: Create, edit, view, suspend, and reactivate administrator accounts.
- FR-FE-014: Create and manage roles such as Super Admin, Operations, Finance, Support, and Content Manager.
- FR-FE-015: Assign granular module and action permissions.
- FR-FE-016: Search, filter, and paginate admin users.
- FR-FE-017: View user activity and privilege changes.

Backend

- FR-BE-013: Store admin users, roles, permissions, and assignments.
- FR-BE-014: Enforce role-action-resource authorization.
- FR-BE-015: Prevent unauthorized privilege escalation.
- FR-BE-016: Support account suspension and access revocation.
- FR-BE-017: Audit role assignments and permission changes.

## FR-04: Customer Management

Frontend

- FR-FE-018: View searchable customer directory and profiles.
- FR-FE-019: View customer booking and payment histories.
- FR-FE-020: Filter by registration date, account status, and booking activity.
- FR-FE-021: Suspend/reactivate accounts with reason capture.
- FR-FE-022: View loyalty balances, wallet transactions, and saved travellers when supported.
- FR-FE-023: Display customer support history and account flags.

Backend

- FR-BE-018: Retrieve customer profiles and related transactions.
- FR-BE-019: Support authorized customer-account status transitions.
- FR-BE-020: Maintain verified contact details and profile status.
- FR-BE-021: Expose paginated customer searches.
- FR-BE-022: Apply field-level masking and access control to PII.
- FR-BE-023: Track account changes and customer-related administrative actions.

## FR-05: Flight Management

Frontend

- FR-FE-024: Manage airline and flight-supplier integration profiles.
- FR-FE-025: Search schedules, routes, and fare availability.
- FR-FE-026: View cabin classes, baggage rules, fare restrictions, and fare families.
- FR-FE-027: Inspect flight booking, PNR, and ticketing status.
- FR-FE-028: Manage booking disruptions, ticketing exceptions, and fare discrepancies.
- FR-FE-029: Configure supported service fees and commercial markups.
- FR-FE-030: View supplier synchronization errors.

Backend

- FR-BE-024: Integrate with authorized GDS, airline, or flight aggregator APIs.
- FR-BE-025: Normalize flight schedules, fares, tax, and ancillary data.
- FR-BE-026: Query real-time seat and fare availability.
- FR-BE-027: Revalidate price and availability before booking.
- FR-BE-028: Orchestrate reservation, PNR creation, ticket issuance, and status reconciliation.
- FR-BE-029: Apply configured markups, fees, and commissions.
- FR-BE-030: Synchronize supplier schedule changes and booking disruptions.
- FR-BE-031: Support supplier-specific cancellation, void, and refund requests.

## FR-06: Hotel & Property Management

Frontend

- FR-FE-031: View hotels and properties with filters.
- FR-FE-032: Onboard new hotels and homestays.
- FR-FE-033: Create/edit property name, description, location, and contact details.
- FR-FE-034: Manage images, amenities, facilities, and house rules.
- FR-FE-035: Configure check-in, check-out, and cancellation policies.
- FR-FE-036: Approve, reject, suspend, or delist properties.
- FR-FE-037: View listing completeness and validation errors.

Backend

- FR-BE-032: Manage property master data and associated suppliers.
- FR-BE-033: Validate mandatory listing information.
- FR-BE-034: Store image references and media metadata.
- FR-BE-035: Implement property lifecycle states: Draft, Pending Review, Published, Suspended.
- FR-BE-036: Manage property policies and version history.
- FR-BE-037: Support location/geospatial indexing and listing publication.
- FR-BE-038: Sync property content from authorized external suppliers.

## FR-07: Hotel Room Inventory & Rate Management

Frontend

- FR-FE-038: Add and manage room types and occupancy limits.
- FR-FE-039: Manage room availability through calendar views.
- FR-FE-040: Update nightly prices and rate plans.
- FR-FE-041: Bulk-update price, inventory, and restrictions.
- FR-FE-042: Configure minimum stay, stop-sell, and blackout dates.
- FR-FE-043: View reservations and inventory changes.
- FR-FE-044: Configure refundable/non-refundable rate plans.

Backend

- FR-BE-039: Maintain date-level inventory and rate-plan data.
- FR-BE-040: Perform atomic inventory reservations and releases.
- FR-BE-041: Prevent overselling when multiple users reserve concurrently.
- FR-BE-042: Support inventory holds with expiration.
- FR-BE-043: Apply occupancy, date, seasonal, and promotional price rules.
- FR-BE-044: Synchronize availability and rates with channel managers.
- FR-BE-045: Record inventory adjustments and reconciliation discrepancies.

## FR-08: Bus Booking Management

Frontend

- Manage bus operators, route catalogues, boarding and drop-off points.
- Display bus schedules, amenities, fares, and seat layouts.
- View booked seats and availability.
- Manage operator disruptions and cancellation rules.
- Inspect booking and ticket-confirmation status.

Backend

- Integrate bus suppliers and normalize schedule, route, and seat data.
- Obtain real-time availability and pricing.
- Create seat holds where supported.
- Confirm bus bookings with the supplier.
- Synchronize operator cancellations, departures, and service changes.
- Reconcile supplier booking responses with internal status.

## FR-09: Train Booking Management

Frontend

- Display train routes, schedules, stations, and travel classes.
- View seat availability and fare data from authorized providers.
- Inspect train booking status and PNR information.
- View cancellations and supplier-provided refund statuses.
- Manage train-related service incidents.

Backend

- Integrate with authorized railway booking providers.
- Query schedules, fares, and seat availability.
- Submit booking requests through permitted supplier workflows.
- Track confirmation, waitlist, cancellation, and refund status where supported.
- Reconcile asynchronous booking status changes.
- Enforce supplier-specific rules and restrictions.

## FR-10: Cab & Transfer Management

Frontend

- Manage cab suppliers, vehicle categories, and supported service areas.
- Configure city, airport-transfer, and outstation availability.
- View distance, duration, fare breakdown, and trip status.
- Monitor cab bookings, cancellations, and supplier escalations.
- Configure included distance, waiting fees, and other charge rules.

Backend

- Integrate authorized cab suppliers.
- Calculate quotes or retrieve supplier pricing.
- Validate service coverage and availability.
- Create and synchronize cab reservations.
- Process cancellation and rescheduling requests.
- Record actual trip charges and reconciliation data.

## FR-11: Holiday Package Management

Frontend

- Create, edit, preview, publish, and unpublish holiday packages.
- Manage itineraries, destinations, inclusions, and exclusions.
- Add package media, travel dates, occupancy, and pricing.
- Configure child policies, add-ons, and cancellation rules.
- Manage package inventory, supplier allocations, and approval workflows.

Backend

- Store package definitions and itinerary versions.
- Calculate package prices using selected components and commercial rules.
- Maintain package availability and booking constraints.
- Orchestrate reservations across package components.
- Handle component booking failures and compensation workflows.
- Track package fulfillment and supplier confirmations.

## FR-12: Centralized Booking Management

Frontend

- FR-FE-045: Show all bookings in a unified table.
- FR-FE-046: Filter by booking ID, customer, PNR, travel date, product, supplier, and status.
- FR-FE-047: Display booking timeline and complete booking details.
- FR-FE-048: View ticket, voucher, invoice, and confirmation documents.
- FR-FE-049: Allow authorized cancellation, rescheduling, and correction actions.
- FR-FE-050: Display payment, supplier confirmation, and fulfillment status separately.
- FR-FE-051: Support booking exception queues, assignment, and escalation.

Backend

- FR-BE-046: Maintain a common booking reference across travel products.
- FR-BE-047: Implement product-specific booking state machines.
- FR-BE-048: Store passenger, traveller, pricing, supplier, and fulfillment references.
- FR-BE-049: Support idempotent booking requests and retries.
- FR-BE-050: Process supplier callbacks and booking-status updates.
- FR-BE-051: Detect inconsistent or stalled booking states.
- FR-BE-052: Provide controlled admin actions and enforce valid state transitions.
- FR-BE-053: Publish booking lifecycle events for downstream systems.

## FR-13: Payment & Transaction Management

Frontend

- FR-FE-052: View payments and associated booking records.
- FR-FE-053: Filter by transaction ID, provider, payment method, and status.
- FR-FE-054: Inspect transaction attempts and failure reasons.
- FR-FE-055: View payment capture, partial capture (if supported), and settlement statuses.
- FR-FE-056: Show refund eligibility and the refund action for authorized users.
- FR-FE-057: Display reconciliation exceptions.
- FR-FE-058: Export finance-approved transaction reports.

Backend

- FR-BE-054: Integrate payment gateways and wallet providers.
- FR-BE-055: Implement payment authorization/capture workflows as supported by providers.
- FR-BE-056: Validate and deduplicate provider webhooks.
- FR-BE-057: Enforce idempotency for payment and refund operations.
- FR-BE-058: Maintain auditable transaction and ledger records.
- FR-BE-059: Reconcile payments against provider and bank settlement data.
- FR-BE-060: Store financial amounts using exact decimal/minor-unit representations.
- FR-BE-061: Prevent duplicate charges and inconsistent booking/payment states.

## FR-14: Cancellation & Refund Management

Frontend

- FR-FE-059: Search and view cancellation/refund cases.
- FR-FE-060: Display cancellation policy and computed charge breakdown.
- FR-FE-061: Support full and partial cancellation where permitted.
- FR-FE-062: Allow authorized manual refund approval/rejection.
- FR-FE-063: Display refund initiation, processing, success, and failure statuses.
- FR-FE-064: Capture exception reasons and approval comments.
- FR-FE-065: Display estimated timelines based on provider policy.

Backend

- FR-BE-062: Evaluate booking- and supplier-specific refund eligibility.
- FR-BE-063: Calculate cancellation penalties, fees, and refundable amounts.
- FR-BE-064: Process supplier cancellation before or alongside payment refund according to the workflow.
- FR-BE-065: Integrate payment provider refund APIs.
- FR-BE-066: Support partial refunds, repeated callbacks, retries, and reconciliation.
- FR-BE-067: Enforce approval limits and finance permissions.
- FR-BE-068: Track refund state independently from cancellation state.

## FR-15: Offers, Coupons & Promotions

Frontend

- Create and edit coupons and promotional campaigns.
- Configure discount type, value, budget, eligibility, and expiry.
- Set minimum booking value and maximum discount.
- Restrict campaigns by product, customer segment, travel dates, and payment methods.
- View campaign usage, redemptions, and performance.
- Activate, pause, or terminate campaigns.

Backend

- Maintain promotions and associated rule versions.
- Validate eligibility at quote and checkout.
- Calculate discounts with stacking and exclusion rules.
- Enforce redemption counts and budgets atomically.
- Handle reserved, redeemed, reversed, and expired coupon states.
- Prevent duplicate redemption and promotion abuse.

## FR-16: Supplier & Partner Management

Frontend

- Onboard airlines, hotel partners, bus operators, cab providers, and other suppliers.
- Manage business identity, contact, tax, and contractual details.
- Configure supported products and service regions.
- Manage API integration credentials through secure configuration interfaces.
- Approve, suspend, or deactivate supplier accounts.
- View integration health, booking performance, and supplier disputes.

Backend

- Maintain supplier profiles, contracts, and status.
- Enforce supplier-specific commercial rules.
- Store credential references securely using a secrets manager.
- Manage API integration configuration and lifecycle.
- Normalize supplier data into platform-specific domain models.
- Track supplier response failures, contract validity, and reconciliation issues.

## FR-17: Commission & Settlement Management

Frontend

- Configure commissions and commercial agreements by supplier/product.
- View payable and receivable balances.
- Generate settlement statements.
- Review deductions, refunds, and adjustment entries.
- Approve settlement batches.
- Monitor disputed and overdue settlements.

Backend

- Calculate supplier and partner commissions under versioned rules.
- Maintain financial ledger entries for commissions and adjustments.
- Calculate net settlements from eligible transactions.
- Generate statements with source transaction references.
- Prevent duplicate settlements.
- Support payout integration, approval, and settlement reconciliation.

## FR-18: Customer Support & Dispute Management

Frontend

- View and search customer support tickets.
- Create tickets linked to customers, bookings, and transactions.
- Assign cases to support teams and agents.
- Set priority, category, and SLA.
- View case comments, attachments, and activity history.
- Escalate, resolve, or reopen cases.
- View supplier and payment disputes.

Backend

- Maintain ticket workflows and assignment rules.
- Link tickets with related business entities.
- Track SLA deadlines, escalations, and resolution states.
- Maintain internal and customer-visible notes.
- Integrate with approved communication channels.
- Preserve immutable case activity history.

## FR-19: Reviews & Ratings Moderation

Frontend

- View property reviews and ratings.
- Filter reviews by product, rating, date, and moderation status.
- Approve, reject, hide, or flag reviews.
- Capture moderation reasons.
- View reported review content and supporting context.

Backend

- Store reviews, ratings, and moderation decisions.
- Validate review eligibility where applicable.
- Detect spam and duplicate submissions.
- Recalculate published aggregate ratings.
- Enforce content policies and moderation audit trails.

## FR-20: Content Management System (CMS)

Frontend

- Manage homepage banners, destination pages, and promotional cards.
- Edit content categories, destination descriptions, and FAQs.
- Upload and organize media assets.
- Preview desktop and mobile content.
- Schedule publication and expiry.
- Support draft, review, approval, and publish workflows.
- Configure SEO metadata and promotional deep links.

Backend

- Maintain content definitions, versions, and publication states.
- Store media in managed object storage.
- Apply content validation and sanitization.
- Expose published content APIs.
- Invalidate cached published content after updates.
- Support content scheduling and rollback.
- Maintain approval records.

## FR-21: Notifications & Communication

Frontend

- Manage booking confirmation and cancellation templates.
- Configure email, SMS, push, and messaging templates.
- View notifications sent to customers and suppliers.
- Configure event-triggered communications.
- Preview templates and localized messages.
- Inspect delivery failures and retry status.

Backend

- Generate notification events from business workflows.
- Integrate email, SMS, push, and approved messaging providers.
- Manage templates, personalization, and localization.
- Queue notifications for asynchronous delivery.
- Support bounded retries, deduplication, and failure handling.
- Track delivery, bounce, and failure statuses.
- Apply consent and communication preferences.

## FR-22: Reports & Business Intelligence

Frontend

- Generate booking, revenue, refund, commission, and settlement reports.
- Filter reports by product, supplier, destination, date, and currency.
- View trend charts and comparative analytics.
- Export permitted reports to CSV/XLSX.
- Schedule periodic report delivery.
- View report generation history and availability.

Backend

- Provide reporting read models and aggregation APIs.
- Maintain metric definitions consistently across reports.
- Generate large reports asynchronously.
- Store report artifacts securely with expiry/retention controls.
- Enforce permissions on report data and downloads.
- Support scheduled generation and delivery.
- Track report status and generation errors.

## FR-23: Audit Logs & Compliance

Frontend

- View administrative activity logs.
- Search by administrator, action, resource, date, and result.
- Inspect before/after changes for supported records.
- View privileged actions and financial approval history.
- Export authorized audit reports.

Backend

- Record actor, operation, target entity, timestamp, outcome, and correlation ID.
- Track changes to security settings, supplier contracts, booking states, and money movements.
- Maintain tamper-resistant audit history.
- Mask sensitive values in audit payloads.
- Enforce access and retention policies.
- Support audit event exports and investigation workflows.

## FR-24: Platform Configuration & Integrations

Frontend

- Configure currencies, languages, time zones, and supported regions.
- Manage product enablement and feature flags.
- Configure booking timeouts, inventory hold policies, and approval limits.
- Manage payment and supplier integration settings.
- View integration health and synchronization failures.
- View and update platform operational rules within permitted limits.
- Inspect configuration change history.

Backend

- Maintain versioned application and business configuration.
- Validate configuration changes before activation.
- Distribute configuration safely across services.
- Support feature flag evaluation and controlled rollout.
- Configure payment, supplier, and messaging adapters.
- Maintain integration health and error tracking.
- Audit configuration changes and support rollback.

# 3. Frontend screen inventory

A suggested React/Next.js or Angular admin application can use the following navigation structure.

Admin portal navigation

Dashboard

User Management

Travel Products

Flights

Hotels & Properties

Room Inventory & Rates

Buses

Trains

Cabs & Transfers

Holiday Packages

Booking Operations

All Bookings

Pending Confirmations

Ticketing Exceptions

Cancellations

Refunds

Finance

Partners

Marketing & CMS

Support

Reports

System

Every searchable management screen should provide appropriate filters, sorting, server-side pagination, details views, permission-aware actions, validation messages, loading/error states, and explicit confirmation for destructive or financial actions.

# 4. Backend functional domains and service boundaries

These are recommended logical domains, not a requirement to create a microservice for every module.

| Backend domain           | Primary responsibilities                                  |
| ------------------------ | --------------------------------------------------------- |
| Identity & Access        | Admin accounts, authentication, authorization             |
| Customer                 | Profiles, account lifecycle, traveller information        |
| Travel Catalog           | Flight/hotel/transport/package product metadata           |
| Pricing & Offers         | Markups, service fees, discounts, promotions              |
| Availability & Inventory | Supplier availability, local allocations, inventory holds |
| Booking & Fulfillment    | Reservations, booking state, ticketing, confirmation      |
| Payment & Ledger         | Payment attempts, capture, financial records              |
| Cancellation & Refund    | Cancellation policies, refunds, approvals                 |
| Supplier Integration     | External APIs, adapters, callbacks, normalization         |
| Partner & Settlement     | Supplier management, commissions, payouts                 |
| Support                  | Tickets, cases, escalations                               |
| Content & Reviews        | CMS, property content, moderation                         |
| Notification             | Email/SMS/push events and delivery                        |
| Reporting                | Operational projections, metrics, exports                 |
| Audit & Configuration    | Audit history, feature settings, configuration            |

For a Java 21 / Spring Boot implementation, PostgreSQL can own transactional state, Kafka can distribute lifecycle events, Redis can support appropriate caching and short-lived coordination, and object storage can hold media and generated documents. The actual deployment boundaries should follow scale, team ownership, and transaction requirements.

# 5. Critical backend business workflows

## Booking lifecycle

Illustrative booking workflow

Search & Select

Revalidate Price & Availability

Create Booking / Supplier Hold

Process Payment

Confirm Supplier Reservation

Booking Confirmed

Generate Voucher / Ticket & Notify

Supplier confirmation and payment sequencing vary by supplier and product. Failed steps need explicit recovery, reconciliation, or compensation paths.

Mandatory business rules:

- Never assume payment success means booking success.
- Prevent duplicate payments, inventory holds, and supplier reservations.
- Treat booking, payment, supplier fulfillment, and refunds as separate state machines.
- Reconcile uncertain outcomes after network timeouts.
- Reject unauthorized or invalid administrative state changes.
- Ensure financial records remain traceable and corrections are represented as adjustments rather than silent overwrites.

## Other essential workflows

| Workflow                 | Backend behavior                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| Hotel reservation        | Validate nightly inventory, reserve available units atomically, expire holds safely        |
| Flight ticketing         | Recheck fare, create supplier reservation, ticket, reconcile unknown responses             |
| Booking cancellation     | Check eligibility, request supplier cancellation, record outcome, initiate eligible refund |
| Refund processing        | Approve request, submit provider refund, deduplicate callbacks, reconcile final status     |
| Supplier onboarding      | Validate supplier, review contract, approve, activate catalog/integration                  |
| Settlement               | Calculate payable balances, approve batch, initiate payment, reconcile payout              |
| Coupon redemption        | Check eligibility, reserve budget, redeem on successful booking, reverse on failure        |
| Admin account suspension | Revoke applicable sessions, update account status, record reason and audit event           |

# 6. Core API requirements

Illustrative REST API resource design:

| Module               | API endpoints                                                            |
| -------------------- | ------------------------------------------------------------------------ |
| Admin Authentication | `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/logout`        |
| Dashboard            | `GET /api/v1/admin/dashboard/summary`                                    |
| Admin Users          | `GET, POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`        |
| Roles                | `GET, POST /api/v1/admin/roles`                                          |
| Customers            | `GET /api/v1/admin/customers`, `GET /api/v1/admin/customers/{id}`        |
| Flights              | `GET /api/v1/admin/flights`, `GET /api/v1/admin/flight-bookings`         |
| Hotels               | `GET, POST /api/v1/admin/hotels`, `PATCH /api/v1/admin/hotels/{id}`      |
| Inventory            | `GET, PUT /api/v1/admin/hotels/{id}/inventory`                           |
| Bookings             | `GET /api/v1/admin/bookings`, `GET /api/v1/admin/bookings/{id}`          |
| Cancellations        | `POST /api/v1/admin/bookings/{id}/cancellations`                         |
| Payments             | `GET /api/v1/admin/payments/{id}`                                        |
| Refunds              | `GET /api/v1/admin/refunds`, `POST /api/v1/admin/refunds/{id}/approve`   |
| Promotions           | `GET, POST /api/v1/admin/promotions`                                     |
| Suppliers            | `GET, POST /api/v1/admin/suppliers`                                      |
| Settlements          | `GET /api/v1/admin/settlements`                                          |
| Support              | `GET, POST /api/v1/admin/support/tickets`                                |
| Content              | `GET, POST /api/v1/admin/content`                                        |
| Reports              | `POST /api/v1/admin/reports/jobs`, `GET /api/v1/admin/reports/jobs/{id}` |
| Audit                | `GET /api/v1/admin/audit-events`                                         |
| Settings             | `GET, PATCH /api/v1/admin/settings`                                      |

Actions that can move money or alter confirmed bookings should require server-side authorization, valid workflow transitions, audit metadata, and idempotency controls where needed. These API endpoints are proposed contracts, not verified makmyticket endpoints.

# 7. MVP delivery scope

A practical initial release should focus on administrative operations for whichever travel products the customer-facing application supports.

| Phase                            | Functional scope                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| Phase 1 — Core platform          | Authentication, RBAC, dashboard, admin users, customer management, audit, configuration         |
| Phase 2 — Core travel operations | Flight/hotel supplier integrations, hotel inventory, bookings, payments, cancellations, refunds |
| Phase 3 — Commercial operations  | Partner management, commissions, settlements, promotions, reports                               |
| Phase 4 — Extended products      | Bus, train, cab, holiday packages, each with its own fulfillment and cancellation workflows     |
| Phase 5 — Advanced operations    | CMS, customer support, review moderation, advanced BI, workflow automation                      |

Phase 1 and Phase 2 together form the minimum operational foundation for a flight-and-hotel booking business, assuming the corresponding customer booking journeys already exist.

## 8. Important architecture decisions

Before turning this catalogue into implementation tickets, four decisions materially affect the backend design:

1. Operating model: Is this a platform-operator admin panel, a hotel/supplier extranet, a travel-agent portal, or all three? Each needs different permissions and workflows.
2. Inventory ownership: Are flights/hotels sourced through third-party aggregators, directly contracted suppliers, or both? This determines booking, pricing, and synchronization responsibilities.
3. Payment ownership: Does the platform collect customer payments and settle suppliers, or do suppliers collect directly? This determines ledger, refund, and settlement workflows.
4. Launch products: Flights and hotels only, or buses, trains, cabs, and holiday packages from day one? This determines the required supplier integrations and fulfillment state machines.

Recommended baseline: Build one operator admin panel with strong resource-level RBAC, unified booking visibility, and separate supplier/payment/fulfillment state handling. Add distinct supplier and travel-agent portals only where their workflows justify separate experiences.

This gives you an initial functional specification with 24 admin modules, frontend/back-office screen requirements, backend capabilities, business workflows, and suggested APIs. The next specification level would be module-wise user stories, acceptance criteria, validation rules, permission matrices, and API request/response contracts.