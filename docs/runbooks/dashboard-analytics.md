# FR-02 dashboard analytics

Open `/admin/dashboard` with a platform finance grant and current MFA. Apply calendar/preset/custom dates and optional product, city, partner reference and booking-state filters. INR is the only supported currency. Calendar year/unit/index matter only when Calendar period is selected. Custom end dates are exclusive, with a maximum span of 366 days. Today/Yesterday/7/30-day boundaries use database time in Asia/Kolkata. Last 7/30 days include today.

The dashboard provides total bookings, booking-active customers, GBV, captured cash, cancellation counts, current recovery obligations, provider-refunded/failed attempts, product counts/value, booking-state breakdown, current inventory allocation, recent bookings, daily/monthly charts and accessible chart tables. Operational alerts show payment-order failures/unknown outcomes/review flags and support cases when support access is present. These are period-scoped records, not an all-time backlog.

Filters use the current catalog's city, product and organization ownership. Mixed-component orders count in full when any component matches and stay mixed/unmapped in product breakdown. Payment/support periods use their own recorded dates, so they can include events for bookings created earlier. Booking-state filters apply to related payment/support records. Inventory uses occurrence start dates and catalog filters; booking-state filters do not apply. All demo records remain included and disclosed.

Every successful refresh saves an immutable report with capture time and metric-definition version. Saved links and the latest 20 report captures are available in the UI. A historical report retains original totals after underlying state changes. It is not a reconstructed day-end report. History retrieval rechecks current permissions and redacts support counts for readers without support permission. No automatic retention deletion is configured; approve retention/archival before production-scale operation.

KPI links open `/admin/dashboard/records` with pinned dates and matching filters. Finance-only viewers can inspect financial records; booking, customer and support rows additionally require bookings.read, customers.read and support respectively. Results are server-paginated (25 rows), cursors cannot move between users/filters, and no private provider identifiers, customer contacts or support text are exposed. Opening related business details shows current state. Historical captures intentionally omit live KPI drilldown links.

API:
- `GET /api/v1/admin/dashboard`: filtered metrics, series, capture metadata and ID.
- `GET /api/v1/admin/dashboard/records`: matching current rows; kind bookings/confirmed/cancelled/customers/captures/recovery/refunded/failed/exceptions/support.
- `GET /api/v1/admin/dashboard/history`: latest 20 captured reports.
- `GET /api/v1/admin/dashboard/history/:id`: immutable captured report, with current permission redaction.

The generated OpenAPI contract documents query fields and response schemas. Apply migration 073 using the existing migration command before running version 0.95.0. No new privilege is seeded. A snapshot write/audit failure fails the whole read transaction; no partial historical record is committed.

Limitations: travel products and supplier-sync failures have no source data in this ticketing app. Completed-refund counts/amounts and net earnings cannot be inferred from payment attempts/recovery obligations. Current figures use authoritative-table queries rather than a production-scale precomputed analytical warehouse. Browser verification was attempted but the browser access host was unavailable; no screenshot, browser interaction or accessibility acceptance is claimed.
