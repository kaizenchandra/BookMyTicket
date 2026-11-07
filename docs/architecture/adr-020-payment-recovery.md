# ADR 020 — customer-triggered durable Razorpay reconciliation

Keep the existing Payments port/concrete Razorpay adapter and shared atomic booking confirmation. The requested third-party reference repository is inaccessible (anonymous HTTP 404); implement independently from official provider documentation and record the uncompleted comparison.

Add owner-authenticated POST `/api/v1/bookings/:id/payment/reconcile`. It accepts no amounts/provider IDs and creates no charges. Payments locks its provider-order row, refuses review-blocked records, and brings due time forward only when safe. Thirty-second persisted deduplication, an initial create grace, active leases and failure backoff prevent request storms or bypassing recovery controls. The worker from the same application artifact processes the durable request; the browser continues reading status. No transaction spans external network I/O.

Explicitly bind callback's provider order ID to the existing trusted mapping, while computing HMAC from the server-stored mapping. Keep capture checks separate from callback verification. Raw webhook ingestion now rejects malformed/null payloads and conflicting reuse of an event ID; identical signed content remains idempotent.

UI distinguishes refreshing saved status from requesting provider verification. Provider initialization failures reset the script loader for recovery. Hosted Checkout appearance and enabled payment methods remain provider-controlled. No new runtime packages or internal services.

Migration 025 adds the recovery request timestamp. This is an additive migration; no records or financial states are rewritten. Automated tests use PostgreSQL and real application HTTP components; synthetic cryptographic fixtures are never evidence of provider connectivity. Current secrets are unconfigured. Live/Test Mode payments and public deployment remain blocked on explicit dependencies documented in runbooks/razorpay-checkout.md.
