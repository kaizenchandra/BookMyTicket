# Inbox read-state controls

Open /notifications. The unread total covers the whole account, not only the displayed page. Use Mark displayed unread notifications as read to update at most 20 visible unread records. Notifications arriving after the page load are not included. Individual records offer Mark as read or Mark as unread. These controls do not change booking, payment or support status.

After a successful update the page and count reload. Use Refresh after a network error or stale page; a lost response can be retried safely. A 404 on a bulk request means at least one selected record is unavailable and the whole operation was rejected. Do not remove an ownership check or substitute a global update to resolve this error.

POST /api/v1/notifications/read takes {ids:[UUID,...]} with 1–20 distinct IDs. DELETE /api/v1/notifications/:id/read marks one owner record unread. Existing POST single-read remains available. Current active-account authentication is required. Bulk locking uses sorted UUIDs; repeated reads preserve the first read timestamp. Concurrent read/unread actions follow database order.

Migration 047 creates the unread owner index. Page and count reads are not a frozen snapshot, so totals can change with incoming notifications. Native and Docker evidence: docs/evidence/inbox-actions-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser/accessibility/load acceptance and external message delivery remain open.
