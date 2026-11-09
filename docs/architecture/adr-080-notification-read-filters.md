# ADR 080: Notification read-status views

FE:ENG-04, BE:NTF-11 and BE:API-05 require notification read-state management and retrieval filters. GET /api/v1/notifications now accepts status=all|unread|read. The existing unread=true|false parameter remains supported when status is omitted. Supplying both is rejected, even when apparently equivalent, to avoid conflicting interpretations.

Transport translates the filter to query predicates; read status combines with category before existing owner-scoped cursor pagination. Read-only uses non-null read_at; unread uses null. Omitted/all preserves the existing full list. unreadCount remains the total across the inbox. Read/unread mutation semantics and deep-link permissions are unchanged.

The frontend replaces the unread-only checkbox with All notifications/Unread/Read selection. Changing status resets the cursor and keeps category. Account changes reset status to all. Empty-result copy reflects the selected status. Marking a read-view item unread refreshes that view and removes the item from it. Pages remain live, not snapshots.

Tests traverse 23 read bookings over 20+3 pages, verify category combinations and read timestamps, legacy filter equivalence, transitions between views, global unread counts, account isolation and malformed/ambiguous queries. No migration is required. Browser interaction/accessibility and load acceptance remain open.
