# Listing review queue

Open /admin/listings using a moderator account with the required MFA. Filter movie/event/sports submissions, read the listing, select a decision, enter a reason and save. Publication still requires an approved provider and the reviewed listing version. A failed or unknown save retains the form; refresh the queue to check current state before retrying.

GET /api/v1/admin/listings accepts kind and paired afterCreatedAt/afterId values from nextCursor. Preserve the UTC timestamp's six fractional digits. Pages contain at most 20 items; nextCursor=null means no next page existed when queried. Filters reset pagination, while first/next navigation preserves the selected kind.

The live queue orders by listing creation time. An earlier listing resubmitted later may sit behind your current cursor: restart on the first page to see it. An empty later page can result from concurrent reviews. The legacy aggregate /api/v1/admin/reviews retains capped arrays for compatibility and is not the full queue.

Migration 051 runs through the normal migration service. Isolated tests create synthetic listing fixtures; deployment creates no listings or moderator grants. Evidence prefix: docs/evidence/listing-queue-. Browser/accessibility, unsaved-form navigation protection and load acceptance remain open.
