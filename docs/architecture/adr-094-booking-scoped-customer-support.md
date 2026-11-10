# ADR 094: Booking-scoped customer support

FE:SUP-C-02, FE:SUP-C-04, BE:SUP-01 and BE:API-05 are advanced by customer case filtering and navigation from booking details. Existing booking-link validation and case creation/reply workflows remain authoritative.

GET /api/v1/cases accepts optional bookingId in addition to existing caseId/after. The owner predicate and booking predicate apply before the 100-item page limit. No booking existence or ownership claim is inferred from a filter: foreign/unknown references simply have no matching owned cases. Creating a linked case still verifies the booking through the Bookings public contract and rejects a foreign reference.

The normalized booking UUID becomes part of the cursor scope when supplied. Changing booking or account rejects a previous cursor; calls without a booking filter retain the old scope representation for compatibility. Exact case selection can combine with booking selection, while the existing exact-case/after exclusivity remains enforced. Query response fields and privacy boundaries are unchanged.

Booking details link to /cases?bookingId=… using a shared encoded-link helper. The customer page shows the applied booking reference and initializes the optional new-case booking field from it. Conversation links, back-to-list, newest and older-page links retain the filter. Clearing the filter is explicit. An untouched prefilled reference alone does not count as an unsent draft; actual entered subject/body/reference changes retain existing discard protection. Successful case creation clears text while preserving the contextual reference.

Tests cover 102 filtered cases and a new arrival, exact-case intersections, UUID case normalization, filter/account cursor mismatch, foreign-booking isolation, actual linked case creation/denial and safe URL encoding. No migration is needed. Browser/sign-in/draft navigation, accessibility/load, attachments and broader support acceptance remain open.
