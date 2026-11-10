# ADR 090: Customer booking milestones

FE:BKG-03 and BE:BKG-13 require detailed timelines. This increment exposes recorded booking milestones only: order creation, policy acceptance, confirmation, pending-order cancellation and confirmed-free-booking cancellation. Payment-attempt, refund and occurrence-disruption histories remain open and are not inferred from current state.

GET /api/v1/bookings/:id/timeline authenticates the current account and invokes a Bookings application query. Its PostgreSQL adapter uses one statement/snapshot for current state and milestones, reading only Bookings-owned tables. The order must belong to the actor; missing and foreign orders both return 404. Cancellation records must also match the owner. No other module's private storage is accessed.

The response contains bookingId, currentState, serverTime and a bounded list of at most five named milestones. Only non-null recorded timestamps are included. Creation does not imply confirmation. A legacy cancelled/recovery order without a retained event timestamp does not acquire an invented cancellation/refund event. Confirmed timestamps remain historical evidence even after later cancellation. Reasons, payment provider identifiers, snapshots, attendee data and ticket tokens are excluded.

Events sort by database timestamp with deterministic kind ordering for equal timestamps. UTC microseconds are preserved in transport. The frontend displays India-time labels and shows a retrieved timestamp; occurrence-local times remain in the existing booking details. The timeline is read-only and supplies no action eligibility. Existing authenticated response no-store behavior applies.

The customer booking page loads the timeline, refreshes it after booking updates and provides its own error/retry/refresh controls. It explicitly describes the limited historical coverage and keeps current booking/payment status panels authoritative for actions. Account changes remount the booking details and effect cleanup ignores obsolete requests.

Database/API tests cover precise/tied timestamps, confirmation followed by cancellation, both supported cancellation sources, missing legacy events, recovery state without invented events, strict identifiers/query validation, owner isolation, suspension, no-store and sensitive-field omission. Rendering tests distinguish creation from confirmation. No migration is needed. Full payment/refund/disruption timelines, browser/accessibility/load acceptance remain open.
