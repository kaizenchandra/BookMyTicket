# Booking timeline

Open a booking from My bookings. Booking timeline shows recorded order creation, accepted policies, confirmation and supported cancellations in chronological order. Displayed milestone times use India time; occurrence-local scheduling remains in the booking details.

Order creation is not confirmation. Only recorded milestones appear: older records may lack acceptance or cancellation timestamps. [Payment capture/recovery records](payment-history.md) appear in a separate panel. Full refund and disruption history is not included. Use the existing current booking/payment status and available actions for recovery. Refresh timeline fetches newer milestones; Retry timeline retries a failed request. Booking state-changing actions also refresh the panel.

GET /api/v1/bookings/:id/timeline is owner-only and no-store. It returns bookingId, currentState, serverTime and at most five items containing kind and occurredAt. Foreign and missing bookings return 404; anonymous requests return 401. Dates preserve recorded UTC microseconds. No private reasons, payment identifiers, ticket tokens or attendee data are returned.

No migration is required. Evidence prefix: docs/evidence/booking-timeline-. Full payment/refund/disruption history, browser/accessibility and load acceptance remain open.
