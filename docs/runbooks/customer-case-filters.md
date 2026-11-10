# Filtering customer support cases

On /cases, choose Case status and Case category, then Apply case filters. Choose All statuses/All categories to remove a selection, or Clear status and category to remove both. An active booking filter is preserved. Unsaved new-case drafts retain their existing discard confirmation before navigating.

Newest/Older cases preserve the selections. Opening a conversation keeps those selections in its return link, but the conversation itself remains visible if its status changes during a reply or escalation. Returning to a filtered list can omit that case if it no longer matches. New-case category selection is separate from list filtering.

GET /api/v1/cases accepts optional state and category alongside bookingId. State values are open, in_progress, escalated and resolved. Categories are booking, payment, accessibility and other. Preserve selections when using after; changing filters requires a fresh first page. Requests omitting these filters remain compatible with earlier cursors.

No migration is required. Evidence prefix: docs/evidence/customer-case-filters-. Browser/draft/navigation/accessibility/load and attachment acceptance remain open.
