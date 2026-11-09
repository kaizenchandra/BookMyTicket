# Notification read-status views

In /notifications, choose All notifications, Unread or Read under Read status. Combine this with Bookings, Payments or Support. Status changes return to newest results; older-page navigation preserves filters. Mark as unread removes an item from the Read view after refresh. The displayed unread total remains inbox-wide.

GET /api/v1/notifications accepts status=all|unread|read. Omit it for all records. Existing unread=true|false queries remain supported, but do not send unread and status together: those requests return 422. Category and after remain available. Keep filters while paging and reset after when changing them.

No migration, seed, grants or external messages are needed. Filtering does not mutate read state. Evidence prefix: docs/evidence/notification-status-. Browser interaction/accessibility and load acceptance remain unverified. See ADR 080.
