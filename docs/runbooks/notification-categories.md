# Notification categories

In /notifications, choose All updates, Bookings, Payments or Support. Combine this with Unread only. Changing category starts at newest updates; Older updates keeps the filters. The unread count describes the whole inbox. Open the linked booking/case for current status and authorization.

GET /api/v1/notifications accepts optional category=booking|payment|support alongside unread=true|false and after. Omit category for all templates. Keep filters when paging and clear after when changing them. Invalid or empty categories return 422. Cursor lookup and results are scoped to the authenticated account. Unknown legacy template types appear only in the unfiltered inbox.

No migration, seed, grants or external communications are required. This filters existing notices and does not change delivery or read state. Evidence prefix: docs/evidence/notification-categories-. Browser navigation/accessibility and load acceptance remain open. See ADR 079.
