# Saved venues

Open a public venue from listing showtimes and choose Save to Favorites. Guests are prompted to sign in; the requested save resumes after sign-in and status loading. Saved venues links to /favorites/venues; listing favorites remain at /favorites.

Only the signed-in account can read or change its bookmarks. Unavailable venues remain listed without private venue details and can still be removed. Repeated saves/removals are safe; re-saving an existing bookmark preserves its timestamp. A new save for an unavailable venue returns 404. A suspended account cannot access its favorites.

Pages contain at most 24 bookmarks. Next page uses the returned UUID boundary; First page restarts traversal. Invalid parameters return 422. Retry/Refresh reloads failed reads without retaining stale page links. Bookmarks are not alerts, waitlist entries or reservations.

Migration 045 adds the Profiles-owned table. No existing listing favorites are migrated. Lists recheck current public visibility through the Venues contract. No email or notifications are generated. Native/container evidence: docs/evidence/venue-favorites-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser sign-in continuation, keyboard/visual/accessibility and load acceptance remain unverified; artist/team favorites and alert subscriptions remain open.
