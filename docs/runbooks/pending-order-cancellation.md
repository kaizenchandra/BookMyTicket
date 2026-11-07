# Pending-order cancellation

On `/bookings/:id`, an owner with an order awaiting payment can choose **Review cancellation**, provide a reason, acknowledge the payment-risk notice and confirm **Cancel pending order**. The server supplies eligibility and a two-minute preview. If the preview expires or payment activity begins, review a fresh preview before retrying. Reuse the same operation key and exact body after an unknown response; changing input under that key returns a conflict.

Cancellation releases an unconsumed reservation and prevents future fulfillment of that order. It does not prove that an external payment was stopped. A checkout already opened, a browser callback or an in-flight charge may still complete. Late trusted captures create the existing refund-recovery obligation and balanced customer-refund-liability journal; they do not restore the cancelled order or issue tickets. The UI reports cancellation separately from payment recovery and provides a support link. No email delivery or completed refund is promised.

## Endpoints and state

- `POST /api/v1/bookings/:id/pending-cancellation/preview` with `{}`: current owner, eligibility, payment-activity notice, preview ID/expiry/server time and recorded recovery obligations. Refund amount remains null because this endpoint does not calculate or execute a refund.
- `POST /api/v1/bookings/:id/pending-cancellation` with an `Idempotency-Key` and `{previewId,reason,acknowledgePaymentRisk:true}`: revalidate and atomically cancel the pending order. Successful result has `bookingState:cancelled` and `refundStatus:not_confirmed`.
- The existing booking/payment endpoints remain authoritative for current status. Confirmed bookings reject pending-order cancellation and must use a future purchased-policy-based workflow.

Order locking serializes capture, payment preparation and pending cancellation. Inventory release preserves any seat now owned by another reservation. Cancellation, release, command record, audit and the `booking.pending_cancelled` outbox event are one transaction. Replayed capture events cannot resurrect cancelled bookings. A record lookup failure or consumed-hold inconsistency rolls back and requires investigation; never manually release sold inventory or mark a refund completed to bypass it.

## Verification and remaining work

Migration 015 adds compact order-bound previews, cancellation records and command fingerprints. Eight new tests cover concurrent retries, changed input, ownership, expired/stale previews, payment activity changes, capacity release, replacement seat ownership, capture races/late capture, HTTP behavior and rollback on consumed inventory. Capture inputs are isolated fixtures, not live provider evidence.

89 native/container tests, 28 deployed HTTP checks and local restart/fixture restore checks pass. The restored fixture counts include pending cancellations. Browser host access is unavailable; interaction, visual, mobile/theme and accessibility acceptance remain unverified.

Confirmed-booking full/partial cancellation, deductions, fee/tax treatment, resale policy, provider refund submission/reconciliation, dispute coordination, notifications and production retention remain required. Structured refund rules must be explicitly versioned and configured; do not infer them from existing cancellation prose. This pending-order workflow is not completion of the full REF requirement family.
