# ADR 004 — Durable customer payment initiation and recovery

Status: implementation decision; provider verification blocked by credentials. Scope: FE:PAY-01–12, BE:PAY-04–18, BE:PRC-08, BE:BKG-10/11. No provider Test Mode exception exists.

The owner invokes an empty-body payment command against an accepted order. Bookings locks the order; Inventory validates its active hold and occurrence; Pricing validates the accepted quote. The Payments creation intent commits in that same local transaction. Only the inserting caller invokes Razorpay, outside the transaction. Missing configuration is rejected before persisting an intent. The order identity is the permanent business deduplication key; no client amount or provider order identifier is trusted.

A timeout/crash leaves creating/unknown durable work. A leased reconciler queries orders by receipt, checks exact receipt/amount/currency and refuses ambiguous matches. An empty result never authorizes blind recreation. The worker queries payments on mapped orders independently of the browser. Captures use the existing atomic fulfillment/recovery use case; authorization alone does not confirm. Auto-capture must be configured with the merchant; this application does not perform manual capture.

A signed browser callback uses the stored provider order identifier, then fetches authoritative payment state. No callback directly grants a booking. Customer status is owner scoped, provides server/check timestamps, and exposes no provider payload or payment credentials. UI presents pending/recovery explicitly. Checkout theme uses the supported accent color; the hosted iframe's full Light/Dark appearance is provider-controlled.

Reconciliation leases use tokens, DB time and bounded retries. Failed/ambiguous jobs remain visible in status as review required. Additional investigations, replay UI, refunds and disputes remain separate mandatory phases. Live provider calls and browser interaction are not established by local tests.

Official references checked 2026-11-05:
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
- https://razorpay.com/docs/api/payments/fetch-payments-orders/
- https://razorpay.com/docs/api/orders/fetch-all/

## Retry and operational limits

A stored payment intent blocks another provider-order creation permanently for that internal order. After an authoritative query reports existing attempts all failed, one caller may reopen the same provider order. A stored sorted attempt-ID watermark serializes that retry; the same failed observations cannot authorize another launch. No observed attempts is treated as unresolved, not proof of nonpayment. Retrying still revalidates the current quote, active hold and occurrence. If a checkout creation response is lost before any attempt exists, the customer must use support/reconciliation rather than starting an ambiguous second payment. The investigation UI remains to be implemented.

Reconciliation defaults are labeled development operational policy: one due order per worker iteration, 60-second leases, 60-second successful polling, eight consecutive failures before review, exponential failure delay capped at one hour, and review after seven days. These are not production payment-processing SLAs. Workers skip outbound payment queries when live configuration is absent. Independent mappings and business uniqueness make duplicate captured observations safe; lease tokens fence job completion. Refunded observations are preserved without claiming the unimplemented complete refund ledger workflow.

Tests exercise actual database transactions and HTTP handlers with explicit isolated fixture records. They do not simulate a successful Razorpay API response, perform Test Mode transactions, or establish live provider interoperability. Signature rejection, trusted amount staging, ownership, policy/expiry rejection, stale state handling and retry claims are locally verified. Live success/unknown receipt recovery and hosted-checkout behavior remain blocked verification.
