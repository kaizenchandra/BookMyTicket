# Finding FAQ articles

Open /admin/help with current staff MFA and platform moderation permission. Search by article ID or words occurring together in the question, choose All articles, Published or Unpublished, then Apply filters. Search is a literal case-insensitive substring; it does not search answer bodies. Clear the search field and choose All articles to remove filters.

Each page shows up to twenty articles sorted by ID. Next page preserves applied filters; First page / refresh returns to the start. New drafts may not appear on the first page, so search their unique ID. Publication changes can move articles into or out of filtered results between loads.

Choose an article to edit. List search/navigation are hidden until saving or explicitly discarding the draft; history remains independently available. Finishing creation resets list filters and pagination. Failed list requests expose Retry articles.

GET /api/v1/admin/help accepts q (maximum 100 characters), status (all, published, unpublished) and after (article slug). Return fields are items (maximum twenty) and nextCursor (slug or null). Follow nextCursor with the same filters to retrieve more results; the response no longer contains the entire collection. Permission/MFA and audited-read controls apply to every page.

No migration is needed. Evidence prefix: docs/evidence/help-list-. Browser/accessibility, indexing, public-search pagination and load acceptance remain open.
