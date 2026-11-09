# ADR 079: Notification category filtering

FE:ENG-04, BE:NTF-11 and BE:API-05 require usable notification retrieval, read state and filtering. GET /api/v1/notifications now accepts optional category=booking|payment|support. Omission preserves the full inbox. The domain maps categories to explicit supported template IDs; filtering is based on stored event templates rather than text or link guesses.

The adapter combines category and unread predicates before existing 20-item cursor pagination. Cursor lookup remains owner scoped and preserves exact database timestamp precision. unreadCount remains the total unread count across the owner's inbox, independent of category. Read/unread and mark-displayed behavior remain unchanged. Unknown category values are rejected. Unclassified legacy templates remain available in All updates.

The frontend offers All updates, Bookings, Payments and Support, resets pagination on selection, and combines the choice with Unread only. Account changes clear category, unread mode, cursor, busy state and result messaging. Filtered empty results are explicit. Deep links retain their current permissions and do not grant access.

Tests exercise all six supported templates, booking pagination, unread filtering after marking read, inbox-wide counts, support deep links, invalid queries, authentication and cross-account cursor/data isolation. No migration is required. Browser category/navigation/accessibility and load acceptance remain open.
