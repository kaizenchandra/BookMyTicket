# ADR 015 — Cancellation of confirmed free bookings

Status: implemented locally; browser acceptance pending.

Scope is full cancellation of an explicitly eligible, confirmed zero-total booking. It does not execute refunds, cancel paid orders, or partially cancel bookings. An immutable accepted pricing policy must contain `freeCancellationCutoffMinutes` (0 through 525600). Absence prohibits confirmed-free cancellation; adding this field requires free-booking authorization. Policy approval and assignment retain existing pricing permission/MFA controls. No existing policy is changed.

The customer requests a two-minute preview containing affected resources, ticket count, expiry, zero refund and a full-cancellation consequence. Preview validity is capped by the earliest occurrence cutoff. Owner, booking, inventory/version/occurrence snapshot and ticket IDs bind the stored preview. A changed schedule/version or expired preview requires review again. Execution requires a reason and explicit confirmation, then revalidates policy, occurrence state, deadline and ticket status.

Lock order: owner command serialization → booking → sorted occurrences → reservation/resources → sorted tickets. Admission locks occurrence then ticket, so admission and cancellation serialize. All tickets must be valid and unused single-entry tickets (remaining=1); transferred/revoked/redeemed tickets prohibit this full-booking operation. Occurrences must be open or paused and before the accepted cutoff. Cancelled/closed occurrence disruption handling remains separate support scope.

Inventory and Ticketing own their mutations through public contracts. One transaction revokes tickets, decrements sold capacity, clears only matching seat ownership, releases the consumed reservation, records cancellation/command/audit and publishes `booking.free_cancelled`. Capacity mutation and ticket revocation roll back together on failure. Sold capacity cannot underflow. A free-confirmation marker proves the booking used the free path; no amount supplied by the browser determines eligibility. No payment/refund record or journal is fabricated.

Owner-scoped idempotency keys fingerprint order, preview, reason and confirmation. Changed input conflicts. Replays return the cancelled result without touching capacity; new keys for an already-cancelled booking are recorded without reapplying effects. Thus old retries cannot clear a replacement seat hold. Existing free-confirmation retries also return current cancelled state without reissuing tickets. Durable inbox notices explicitly state that no refund is due.

Migration 020 adds previews, cancellation records and command records. Do not delete cancellation/command records to enable a retry. Retention/cleanup of expired previews, production recovery testing and historical policy migration remain open. Rollback uses a compatible application artifact while retaining ledger-like lifecycle history; no destructive downgrade is provided.

Verification: four tests using real HTTP/PostgreSQL cover concurrent/replayed full cancellation, changed-input rejection, wallet credential suppression, sold-capacity reuse, expired previews, changed occurrences, owner isolation, deadline checks, scan/cancellation races and assigned-seat replacement ownership protection. Isolated fixtures only. Browser/a11y, process-kill, physical scanner and production acceptance are unverified.

Remaining core scope includes paid full/partial cancellation, refund obligations and Razorpay execution/reconciliation, packages/passes, free partial cancellation and disruption policies. This subset does not complete the broad FE:BKG or BE:REF requirements.
