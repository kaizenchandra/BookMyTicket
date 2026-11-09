# Notification date ranges

Open the customer notification inbox, choose either or both date bounds, and select Apply dates. Clear dates returns to an unbounded view. Dates apply to the original event in India time (Asia/Kolkata), including both selected days. A notification delivered late may therefore appear under an earlier event date. The displayed event time uses the same timezone.

GET /api/v1/notifications?fromDate=2026-01-02&toDate=2026-01-02 selects that entire India calendar day. Combine with category, status or the legacy unread filter (status and unread cannot be supplied together). Filters apply before the twenty-item page limit. Preserve filters when sending the returned cursor; page order remains delivery order. The unread total is for the entire inbox.

Malformed dates, year zero and reversed bounds return 422. Authentication and owner isolation apply as usual. No migration or external messages are required. Evidence: docs/evidence/notification-dates-*.txt. Browser/accessibility and load acceptance are still pending.
