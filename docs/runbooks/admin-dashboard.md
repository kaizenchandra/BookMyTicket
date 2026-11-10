# Admin dashboard

Version 0.95.0 adds FR-02 filters, series, drilldowns and historical captures. See the [current analytics runbook](dashboard-analytics.md); the original calendar/cohort definitions below remain applicable.

Open `/admin/dashboard` (linked from the application footer). The API is `GET /api/v1/admin/dashboard?year=2026&group=month&index=11`. Group accepts month, quarter or year; index must be 1–12, 1–4 or 1 respectively. Years 2000–2100 are accepted. Use Refresh to obtain another snapshot. Existing provider approval `/admin` remains available.

Access requires an active account, platform `finance` grant and current MFA. No grants are automatically created. Authorization is rechecked and locked inside a repeatable-read transaction; the report and `dashboard.read` audit commit together. Responses are no-store, bounded to 20 recent bookings, and exclude customer contacts, provider identifiers and ticket secrets.

All periods are half-open IST calendar ranges. As-of is database transaction time. Includes demo records, clearly disclosed in the UI; demo booking count only identifies snapshots explicitly marked demo, so legacy unmarked fixtures may remain included. This is a platform-wide finance report, not a tenant report.

| Metric | Source and definition |
| --- | --- |
| GBV | Sum order value for orders created in period with recorded confirmation; includes subsequently cancelled and complimentary bookings |
| ABV | GBV / ever-confirmed order count, truncated to whole paise; unavailable for zero denominator |
| Cancellation rate | Currently cancelled / all orders created in period |
| Repeat booking rate | Customers with at least two ever-confirmed orders created in period / customers with an ever-confirmed order |
| Cash captured | Payment capture records whose recorded capture date is in period; includes duplicate-payment recovery obligations; not earnings |
| Vertical breakdown | Confirmed cohort GBV classified through current catalog movie/event/sports kind; multi-occurrence or missing classification is mixed/unmapped |
| Refund recovery | Cases created in period grouped by current state; review_required means awaiting review, not refund success |
| Provider-refunded attempts | Latest attempt state refunded with latest observed_at in period; no refund amount inferred from original payment |
| Inventory | Current capacity/sold/unexpired active holds for occurrences starting in period; includes closed/paused inventory; unallocated is not necessarily purchasable |

These are different measurement bases, not reconcilable accounting revenue totals. No completed-refund ledger, supplier commission/net earnings, search attribution, confirmation latency or promo funding reports exist yet. UI marks these unavailable. Travel rate parity and corporate travel policy/budgets are not applicable. No sample numbers are fabricated. Historical cohort totals can change with later confirmation/cancellation; catalog classification can change.

Read queries stay within their owning module; composition injects reporting sources. No external provider calls or booking/inventory mutation occur. Queries currently run on authoritative tables; production-scale projection/load validation, expanded report filters, exports and admin booking drilldown remain future work. Browser visual/accessibility verification has not been performed.
