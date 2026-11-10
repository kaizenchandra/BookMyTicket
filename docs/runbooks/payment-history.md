# Customer payment records

Open a booking from My bookings. Payment history shows durable capture and recovery records, newest first, with amount and recorded time in India time. These times are when the platform recorded the event; they may differ from provider processing time.

A payment capture does not guarantee booking confirmation. A recovery record does not confirm a refund. Consult current booking/payment status and support for available actions. [Newly retained attempt observations](payment-attempt-history.md) are also shown. Earlier transitions, complete refund-ledger history and disruptions remain unavailable. Empty results do not mean no attempt was made.

Use [category and attempt filters](payment-history-filters.md) to narrow the records. Older payment records loads the next twenty-item page with those filters. Newest payment records returns to the beginning. Retry payment history repeats a failed load. Booking updates reset the panel to its newest page.

GET /api/v1/bookings/:id/payment-history is owner-only and no-store. Supply the returned nextCursor as after for the same booking. Each item contains a random/internal record UUID, kind, occurredAt, amountPaise and currency. Provider IDs and private recovery reasons are excluded. Missing/foreign orders return 404; invalid/cross-booking cursors return 422 after ownership is checked.

Migration 070 adds capture timeline IDs and page indexes; it does not alter payment amounts/states. No merchant credentials or external provider calls are required for reading retained records. Evidence prefix: docs/evidence/payment-history-. Full attempt/refund/disruption history and browser/accessibility/load acceptance remain open.
