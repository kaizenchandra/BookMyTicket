# ADR 014 — Explicitly eligible free booking confirmation

Status: implemented locally; browser acceptance pending.

A zero-total order is not payment evidence. Pricing policies now have optional `allowFreeBookings`; absence means not authorized. Pricing staff with the existing grant and fresh MFA must explicitly approve a new immutable policy with this option and assign it to an occurrence. Zero-total quotes are rejected unless the policy allows free bookings. No existing policy or real inventory was silently made free.

Eligibility in this slice means an accepted, approved policy explicitly allows free bookings and the complete immutable INR quote total, including taxes/fees, is zero. No owner override, arbitrary discount, payment callback or browser amount can authorize this path. Restricted complimentary allocations and recipient-specific eligibility are separate unimplemented workflows.

The customer reviews the same policies and attendee form, creates the accepted order, then chooses “Confirm free booking”. The server verifies ownership, zero INR amount, accepted quote and explicit eligibility. It locks the order and checks the active reservation, occurrence/sales state and published listing before consumption. Free confirmation passes `requireActive` to the inventory contract, rechecking database time after resource locks; it does not use paid late-success reacquisition of expired holds.

One local transaction consumes inventory, confirms the order, records a free-confirmation marker, issues encrypted tickets, publishes the existing booking.confirmed event, writes audit and stores an idempotency outcome. There is no Razorpay order, captured-payment record, invented payment ID or zero-value financial journal. The payment status API returns `not_required` when the zero-total order has no payment activity; existing payment activity remains visible if present.

Order locking serializes free confirmation with cancellation and trusted payment confirmation. Owner-scoped operation keys bind to a single order and the strict request body `{confirm:true}`. Changed-order key reuse conflicts. Identical retries return the current booked outcome without consuming inventory or issuing tickets again. A different key for the same already-confirmed order cannot duplicate fulfillment. Keys and free-confirmation markers persist independently of frontend state.

Migration 019 adds free-confirmation and command records. Existing accepted commercial snapshots remain unchanged. Safe rollback retains these records and uses a compatible artifact; do not delete markers or command records to permit retry. Full production retention/restore/rollback verification remains open.

Verification: real Fastify/PostgreSQL tests cover eight concurrent confirmations, later retries, owner isolation, wrong-order key reuse, no provider orders/captures, valid QR wallet output, payment status contracts, missing eligibility, paid orders, expired holds, paused sales, ticket-key failure rollback and cancellation concurrency. These are isolated fixtures, not fabricated production listings or live payments. Browser and admission scanning of this slice are unverified; existing admission tests remain regression coverage.

Scope still open: staff-issued restricted complimentary allocations, free confirmed-ticket cancellation, packages/passes, promotions, post-booking modifications and full platform acceptance.
