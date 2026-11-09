# ADR 039 — Exact inbox pagination boundaries

Notification history retrieved the cursor row's created_at as a JavaScript Date and sent that value back as the SQL boundary. PostgreSQL stores microseconds; JavaScript Date retains only milliseconds. With multiple deliveries inside one millisecond, the second page could skip every remaining notice in that millisecond. A regression with 45 persisted notices reproduced a zero-row second page where 20 were expected.

Keep the existing UUID cursor contract and owner-scoped cursor-row lookup, but select its timestamp as an exact six-fractional-digit UTC string. PostgreSQL then compares the original timestamp and UUID without a lossy Date conversion. Display timestamps may remain JSON ISO milliseconds because they are not pagination boundaries. No migration, backfill or cursor replacement is needed.

The cursor lookup intentionally does not filter by unread state: marking the boundary notice read must not invalidate ongoing unread traversal. Foreign/missing cursors still fail, and each HTTP page authenticates the current active account. New arrivals are found on the newest page. These are live pages, not frozen exports.

Inbox UI clears stale next-cursor state on each load, suppresses older-page navigation after an error, and distinguishes failed loads from empty results. API request and page response schemas are now generated. Account-specific component keys and existing stale-response guards remain in place.

Regression coverage uses exact PostgreSQL timestamps with multiple microsecond groups and tied UUID ordering, new arrivals, boundary read-state changes, unread traversal, foreign/missing cursor rejection and account suspension. The pre-fix failing evidence is retained. Browser/error-state interaction and accessibility remain unverified.
