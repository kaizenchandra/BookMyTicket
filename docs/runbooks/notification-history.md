# Notification history pagination

At /notifications, use Older updates to continue and Newest updates or Refresh to return to current arrivals. Unread only changes which notices are shown; marking a boundary notice read does not invalidate its cursor. New notices appear on the newest page rather than displacing the boundary of an older page.

The API continues to accept the UUID nextCursor as after, with up to 20 notices per page. Preserve that UUID; do not build a cursor from displayed timestamps. Missing or foreign cursors return INVALID_CURSOR. Restart without after if that happens.

Version 0.36.1 fixes skipped notices created within the same millisecond by preserving PostgreSQL timestamp precision. Existing messages and cursor IDs need no migration or backfill. The UI clears stale Older updates controls after failed loads and keeps errors distinct from an empty inbox.

Verify with tests/notifications.test.ts and the documented full native/container suites. Evidence includes inbox-precision-regression-before.txt for the reproduced failure and inbox-precision-tests.txt for the passing focused suite. Browser acceptance remains open.
