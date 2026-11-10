# ADR 091: Customer capture and recovery records

FE:BKG-03 and BE:BKG-13 are advanced with a separate customer payment-history panel. It exposes durable capture and recovery records, not a fabricated payment-attempt transition history. Attempts currently retain only their latest observation; full attempt/refund/disruption timelines remain open.

GET /api/v1/bookings/:id/payment-history authenticates the customer. A Bookings application use case opens a local transaction and verifies ownership with the existing shared-lock order read, then calls Payments through its public PaymentHistory contract. Only the Payments adapter reads payments.captures and payments.recovery. The public contract assumes its caller has authorized the booking; no standalone public Payments route bypasses that check.

Migration 070 assigns random stable timeline UUIDs to captures, including existing rows, and adds booking/time/identity indexes to capture/recovery records. This allows paging without putting provider payment identifiers into responses or cursors. Existing recovery UUIDs identify recovery records. The adapter projects only ID, event kind, amount, INR currency and recorded timestamp. Internal reasons, provider references, webhook payloads and current attempt state are omitted.

The union query returns twenty records plus a lookahead. Newest-first ordering uses recorded time, kind and UUID, with microseconds retained. The validated opaque cursor binds timestamp/kind/ID to the booking; a different booking rejects it. Newer arrivals do not duplicate older pages. Query text and unknown fields are rejected. Owner isolation and no-store apply to every request.

Recorded times describe platform persistence, not provider processing time. Capture does not guarantee booking confirmation, and recovery creation is not refund completion. The panel states these distinctions, displays amounts and India-time dates, supports newest/older navigation, and refreshes after booking updates. Empty history does not assert that no payment attempt occurred. It changes no booking/payment state.

Tests cover twenty-plus-five records with tied/microsecond timestamps, new arrivals, stable identities, provider/reason redaction, cross-booking cursors, owner isolation, suspension, empty results, no-store and presentation semantics. Full attempt/refund/disruption history, approved retention, browser/accessibility and load acceptance remain open.
