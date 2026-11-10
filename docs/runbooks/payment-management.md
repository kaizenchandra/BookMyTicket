# Payment & transaction management

Open `/admin/payments` with finance permission and current MFA. No new grants are automatically assigned.

- Search exact provider transaction/internal attempt IDs; filter booking, Razorpay provider, method, observed state and ISO observation-date range. Unknown historical method values remain included when no method filter is applied.
- Open a transaction to inspect immutable observations, failure codes, original amount, observed refunded amount, local capture, recovery obligation and reconciliation freshness/errors. Booking links require bookings.read. Finance-only transaction references are intentionally visible here.
- Use `/admin/payment-exceptions` for provider orders requiring investigation, including orders with no payment attempts. This is distinct from bank settlement reconciliation.
- To export, apply both observed-date filters (up to 366 days), open “Approve and export transaction report”, supply a reason and confirm approval. The CSV contains every matching row up to 5000; larger reports are rejected so filters can be narrowed. Amounts are integer paise and audit records identify the approving finance actor. This is not a two-person approval workflow.

Provider observations are not settlement records. Refunded observation amounts are not a platform refund ledger. Refund eligibility/execution is not implemented and no executable refund button is presented. Use recovery records to investigate obligations, not to claim money was returned. Merchant auto-capture remains required; manual/partial capture is unsupported by this application. Live merchant/API/webhook tests and bank settlement matching remain outstanding. See razorpay-checkout.md for configuration and existing safeguards; do not put secret values in catalogue fields or chat.

Migration 084 adds normalized metadata to attempts and append-only observation history. Historical metadata is not backfilled. Technical error codes are retained without provider customer/card/VPA data or free-text error descriptions. Current captured/refunded states and cumulative refund observations cannot regress through delayed observations.

APIs: GET `/api/v1/admin/payments`, GET `/api/v1/admin/payments/:id`, GET `/api/v1/admin/payment-exceptions`, POST `/api/v1/admin/payments/reports`. All require finance and fresh MFA; detail history supports an actor-bound cursor. The original `/api/v1/admin/refunds` continues to show recovery obligations.

Validation: 286 native regression tests, production build and architecture checks pass. See docs/evidence/payment-management-*; browser acceptance is unverified.
