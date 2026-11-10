# Bus management

Open `/admin/buses`. An access administrator must assign buses.read for catalogue/history access and buses.manage for mutations. Fresh MFA is required; no grants are automatically seeded.

1. Create an operator with a stable code, business contact and supplier metadata. Do not put API keys/passwords in these fields. Active means selectable in the local catalogue, not externally connected.
2. Create a route with origin/destination and ordered boarding/drop-off stops. Enter each stop's address and elapsed minutes from departure. All boarding points precede drop-off points. Suspension prevents selection for new/edited services.
3. Create a service using active references; search pickers return 25 matches, so refine the search if needed. Enter ISO departure/arrival with timezone (e.g. `2027-01-01T09:00:00+05:30`), amenities, cancellation reference and seat positions/type/deck/indicative paise fares. Every seat label/position must be unique. Last drop-off must fit the scheduled duration.
4. Inspect the route snapshot, IST stop timestamps and visual seat grid. Every seat shows availability Unknown. Reference fares are not live supplier quotes. Booking and ticket status remain unavailable until the supplier integration exists.
5. Edit with a reason, confirmation and current version. Reload/review on conflict. Saving a service refreshes its route snapshot; editing a route alone does not rewrite existing services.
6. Record local disruptions, resolve them, or withdraw a service with a reason. Withdrawal is terminal locally and does not send supplier cancellations, customer notifications or refunds. Before/after policy, layout and incident history is immutable and paginated.

Filters support name/code/status and, for services, operator/route UUID and inclusive-from/exclusive-until departure timestamps. First/next links retain filters. Create retries retain the same actor/operation/key result for unchanged input; stable unique codes also prevent accidental duplicates after a reload.

Migration 079 creates Buses-owned catalogue/history/replay records and expands assignable grants. Existing seat and room inventory is unchanged. FR-08 remains partial: authorized supplier integration, live availability/pricing, holds, booking/ticket confirmation, supplier disruption synchronization and status reconciliation are not implemented. Provide the supplier name, official API documentation and secure sandbox credential location to continue; do not send secrets in chat.

Tests: `tests/bus-administration.test.ts`. Evidence: `docs/evidence/bus-management-*`. Browser acceptance is unverified separately from successful API/database and build checks.
