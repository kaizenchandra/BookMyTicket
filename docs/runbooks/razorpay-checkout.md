# Razorpay checkout, verification and recovery

## Current verification level

The application has a concrete Razorpay HTTPS adapter, server-created orders, browser Standard Checkout, stored-order HMAC verification, raw-body webhook ingestion, leased reconciliation and atomic captured-payment fulfillment. This is **not verified live payment processing**. On 2026-11-07, the local verification container reported all three credential-presence flags false (key ID, key secret, webhook secret); no values were printed. No external orders, charges, refunds or Test Mode transactions were attempted. Demo catalog sessions intentionally cannot collect real money.

Requested reference: https://github.com/kaizenchandra/upi-payment-integration/tree/main/src. Anonymous GitHub API access to its main tree returned HTTP 404. The web fetch also failed; no authenticated GitHub connector or gh CLI was available. No source from this repository was read or copied, and no fidelity to it is claimed. An accessible URL/local checkout is needed to complete that comparison.

## Merchant configuration

Use the existing server-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` settings or their `_FILE` alternatives. Never put secrets in `VITE_*`, browser code, chat, screenshots or git. Do not set both a value and its `_FILE` variant. Compose mounts ignored `.local/compose/secrets/razorpay_key_id`, `razorpay_key_secret`, and `razorpay_webhook_secret` read-only. Supply merchant credentials securely, then recreate the app/worker with the existing Compose command. The public key ID is intentionally returned for Checkout; secrets are never returned.

The current project requires live-mode keys. Existing Test Mode restriction remains in force under the user's no-simulation requirement; enabling merchant Test Mode requires an explicit exception and separate evidence. Do not replace real provider responses with hardcoded success.

Configure merchant auto-capture in Razorpay Dashboard; the application deliberately distinguishes authorized from captured payments and does not perform manual capture. Enable UPI/credit/debit card methods as eligible for that account. Checkout displays methods available from Razorpay rather than collecting raw payment details itself.

Deploy the app and durable worker behind an authorized public HTTPS origin. Set `APP_ORIGIN` to the exact origin. Register `https://<authorized-host>/api/v1/payments/webhook` with the independently configured webhook secret. Localhost alone cannot receive Razorpay webhook delivery. Subscribe to payment.authorized, payment.captured, payment.failed and order.paid; worker handling requires the payment entity and fetches authoritative payment state. Refund/dispute automation remains separate outstanding scope; do not infer support for every event from durable ingestion. `RAZORPAY_PREVIOUS_WEBHOOK_SECRET` can verify older deliveries during a controlled secret rotation.

## End-to-end sequence

1. Customer selects real published, non-demo inventory, creates a hold and accepts an immutable server-calculated INR quote and policies. Order remains pending_payment.
2. Booking page POSTs `/api/v1/bookings/:id/payment` without accepting an amount from the browser. A protected transaction persists one intent. Razorpay order creation happens outside the transaction. Provider order/amount/currency are checked and associated with the internal order.
3. Standard Checkout receives the public key, provider order ID and trusted amount. UPI/card details stay inside Razorpay. Automatic checkout retry is disabled; a retry is offered only after verified failed attempts and another protected server check.
4. Browser callback POSTs providerOrderId/paymentId/signature. The returned order ID must match the stored order, but HMAC calculation uses the server-stored order ID. A signature alone never confirms a booking: authoritative fetched payment must be captured, with the expected order, amount and currency.
5. Webhooks verify exact raw-body HMAC and persist before acknowledgment. Identical event IDs/content deduplicate. A reused ID with changed content is rejected. The worker independently fetches provider state, so browser closure cannot prevent confirmation.
6. Trusted capture processing atomically consumes inventory, confirms the booking, issues tickets, records balanced collection entries and durable fulfillment events. Late success cannot displace another customer; unavailable inventory creates a recorded refund obligation. Refund execution is not yet complete and must not be presented as refunded.
7. GET payment status reads saved observations and shows their freshness. **Check payment with Razorpay** POSTs `/payment/reconcile` to queue durable verification; it does not report a successful payment. Concurrent requests deduplicate for 30 seconds, respect creation grace, worker leases, failure backoff and review blocks. A queued request is not proof of provider connectivity. Periodic polling displays subsequent authoritative outcomes.

## Verification and handoff

Automated PostgreSQL/HTTP fixtures verify amount ownership, protected initiation, retries, reservation expiry, monotonic observations, raw signed webhook ingestion, conflicting deliveries, owner-scoped recovery, throttling, lease/backoff preservation and callback order mismatch. Fixtures and synthetic cryptographic material are isolated to tests; no provider-network success is inferred. See `docs/evidence/razorpay-full-suite.txt` and container/deployment evidence.

Live acceptance still needs accessible reference source, merchant credentials, configured auto-capture/methods, public HTTPS/webhook routing, a legitimate non-demo occurrence and explicit approval for a specified real charge (and any subsequent refund). Verify captured-payment booking/tickets, duplicate deliveries, browser closure and recovery in that environment. Browser host access is currently unavailable. Do not call the complete merchant integration verified until these checks actually pass.

## Official references checked 2026-11-07

- [Standard Checkout integration and stored-order signature verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Webhook raw-body signature, duplicate and out-of-order handling](https://razorpay.com/docs/webhooks/validate-test/)
- [Order receipt lookup](https://razorpay.com/docs/api/orders/fetch-all/)
- [Capture API and authorization distinction](https://razorpay.com/docs/api/payments/capture/)
