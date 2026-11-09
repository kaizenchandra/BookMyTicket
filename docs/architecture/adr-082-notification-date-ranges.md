# ADR 082: Notification event-date ranges

FE:ENG-04, BE:NTF-11 and BE:API-05 are advanced by optional fromDate/toDate filters on GET /api/v1/notifications. Dates are strict ISO calendar dates (years 0001 onward); reversed bounds are rejected. Either bound may be omitted and existing callers retain their behavior.

Dates select occurred_at (the event time), using Asia/Kolkata midnight. The lower bound is inclusive; the upper bound is exclusive midnight of the following day, making both requested days inclusive. PostgreSQL performs timezone conversion; stored timestamps remain unchanged. Delivery time can differ from event time. Existing descending delivery-time/ID pagination and exact owner-scoped cursors remain unchanged.

The application passes date bounds through the Notifications port. The persistence adapter applies them together with category and read-state predicates before the page limit. The unread total remains inbox-wide. No migration or new index is introduced; load acceptance remains open.

The customer inbox provides From date, To date, Apply dates and Clear dates. Applying or clearing resets pagination; category/status and older-page navigation preserve applied dates. Event timestamps display in India time. Account changes reset filters.

Integration coverage checks both India-midnight boundaries, one-sided ranges, multi-page category/unread combinations, leap-date validation, malformed/reversed dates, authentication and account isolation. Browser interaction/accessibility and external-delivery acceptance remain open.
