# Centralized booking operations

Open `/admin/bookings` with `bookings.read` and fresh MFA. Assign `bookings.manage` separately for exception actions and pending cancellation; no permissions are granted automatically.

The directory covers persisted movies/events/sports bookings. Filter booking/customer references, booking state, creation timestamps, saved travel/session start timestamps, current catalogue product and supplier/organizer UUID, exception state or assignee. Filters apply before 25-row cursor pagination. PNRs and travel bookings are not connected; the API's PNR filter returns no matches. All ranges use explicit timezone offsets and an exclusive end.

Exception queues include pending payment for more than 30 minutes (database clock), refund_required and manually tracked open/escalated/resolved cases. A stalled row is a review candidate; it is not proof of payment failure. Open a case from the booking detail; assign it to an active staff UUID with both booking permissions, escalate, resolve or reopen it. Blank assignee unassigns. Provide a reason and confirm. Reload on version conflicts. Resolution changes the case only. Before/after history includes actor, reason and time; changes publish an outbox event atomically with audit.

For a pending-payment booking, use Review cancellation, inspect payment activity and consequences, provide a reason and explicitly acknowledge payment risk before confirming. Expired or changed previews must be refreshed. Cancelling releases only the pending reservation; confirmed inventory cannot be released through this action. Captures arriving afterwards require recovery, and no refund success is implied. Staff actions retain staff audit attribution. Confirmed cancellation, rescheduling and corrections are not implemented here.

Booking, payment records, ticket-status counts and supplier applicability are displayed separately. Ticket credentials are only available through the authorized document download; traveller/contact payloads remain unexposed. Managers can download the existing admission-ticket HTML document from confirmed bookings. Access requires read/manage with current MFA and is audited in the same transaction as authorization. Active ticket credentials follow existing wallet rules. Supplier vouchers/invoices/separate confirmation documents remain outstanding.

APIs: existing GET `/api/v1/admin/bookings`, detail and payments; GET/POST `/api/v1/admin/bookings/:id/exceptions`; POST `/api/v1/admin/bookings/:id/pending-cancellation/preview` and `/pending-cancellation`. Exception actions require expectedVersion, reason and Idempotency-Key. Cancellation requires a current preview, acknowledgement and Idempotency-Key. See generated OpenAPI schemas.

FR-12 remains partial. Travel supplier booking/callback contracts are absent, and the other gaps above remain tracked individually in admin-traceability.json. Build/architecture checks and 282 regression tests pass. Browser verification is unavailable.

Staff admission documents reuse TicketWallet through an optional owner-resolution authority checked within its transaction; customer wallet endpoints remain owner-scoped. No QR credentials are included in audit payloads.
