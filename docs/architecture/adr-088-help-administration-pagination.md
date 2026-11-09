# ADR 088: Bounded and filtered FAQ administration

FE:ADM-UI-08, BE:CAT-10 and BE:API-05 are advanced by replacing the unbounded administration list with twenty-item pages. Public Help search is unchanged and remains a separate scale concern.

GET /api/v1/admin/help accepts optional q, status and after. Search matches a case-insensitive literal substring of article ID or question; percent/underscore are ordinary characters, not SQL wildcard operators. Status is all, published or unpublished. Search/status predicates run before the page limit. The query fetches one lookahead row and returns nextCursor only when another page exists.

Articles sort by immutable ID using PostgreSQL C collation, with the same comparison for after. The cursor is the last displayed ID. Preserve filters when requesting the next page. New articles before the boundary appear on refresh, not on older pages. Publication changes can add/remove matching articles between requests; this is current-state pagination, not a frozen snapshot. An empty result is valid. Clients previously assuming the response contained every article must follow nextCursor.

The application forwards typed filters through the Catalog port. Current MFA/moderation checks and transaction-level active permission rechecks are unchanged. Each page read is audited; metadata records count, whether it is an older page and whether filters apply, without recording raw search text. Audit failure withholds the page.

The frontend offers ID/question search, publication status, first-page refresh and next-page navigation. Applying filters resets the cursor. Search/navigation are hidden during editing/creation to preserve drafts. Creation completion resets filters/page; staff can locate a new draft by ID. Empty, loading and error/retry states remain explicit, with no stale next-page controls during a failed load.

Integration tests cover twenty-plus-six paging, a newly inserted earlier ID, publication-filtered pages, case-insensitive matching, literal percent search, status changes between pages, invalid inputs, revoked permission and audit failure. No migration is required. Browser/accessibility, search indexing and production load acceptance remain open.
