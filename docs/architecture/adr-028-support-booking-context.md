# ADR 028 — Booking-linked support context

Scope: booking-reference portion of FE:SUP-C-02 and FE:SUP-A-05, with BE:SUP-01/05. Attachments and independent payment/refund links remain outstanding.

Case creation accepts an optional full booking UUID. Support calls Bookings' public SupportBookingReader contract inside the case creation transaction. It requires the booking owner to match the authenticated customer; missing and foreign bookings receive the same 404. A failure creates neither case nor initial message. No cross-module table access is introduced.

Migration 033 stores the logical booking reference on the Support-owned case and indexes it. No cross-module database foreign key is introduced. Booking history is already retained; any future booking retention/deletion workflow must explicitly address support links. Existing unlinked cases stay unlinked.

The customer list displays a link to the owned booking. The authorized staff case-detail use case reads current booking status, amount, currency, creation time and reference through the same public contract using the case owner. It does not expose the order snapshot, ticket credentials, attendee responses, card data or provider payment references. Existing support permission and recent MFA remain mandatory on each detail request. A booking state is explicitly not a payment or refund state.

The customer form retains validation errors and disables duplicate submission while a request is pending. This does not implement durable idempotency for case creation; that remains a separate requirement. No staff directory or operational override is added.

Tests use real PostgreSQL and HTTP to verify owned/foreign/missing/malformed references, transactional rejection, customer list linkage, exact staff summary fields, current state changes and permission revocation. Browser access is unavailable, so visual/interactive/accessibility acceptance remains unverified.
