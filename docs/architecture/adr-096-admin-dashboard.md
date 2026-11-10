# ADR 096: Platform finance dashboard

Implement `/admin/dashboard` and `/api/v1/admin/dashboard` as a finance/MFA protected reporting use case. Bookings, Payments, Inventory and Catalog own their queries; Reporting receives structural read ports from the composition root. Shared dashboard types only contain transaction and period contracts. No module queries another module's tables.

A repeatable-read local transaction obtains active staff authorization, composes consistent reads and records access in the audit log. Aggregated bigint amounts use decimal strings; UI uses BigInt, including formatting and chart proportions. Period boundaries use Asia/Kolkata, inclusive start/exclusive end. No database migrations or external provider calls are required.

Metric definitions, unavailable KPIs and demo scope are documented in `docs/runbooks/admin-dashboard.md`. Gross booking value must not be labeled net revenue. Recovery work and provider-refunded attempt status must not be labeled completed refunds. Current allocation must not be labeled historical availability.

Advances FE:ADM-UI-01, FE:RPT-01/02/03/04/06/11 and BE:DAT-01/02/03. These remain partial: full report coverage, filters, drilldown, exports, actual refund completion, margin accounting, browser/accessibility and production-scale load acceptance remain open. Regression tests cover authorization, exact monetary transport, calendar boundaries, confirmed/cancelled cohorts, repeat customers, vertical sum reconciliation, audit, privacy and expired-hold allocation.
