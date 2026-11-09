# Provider review queue

Open /admin with a current moderator account and required MFA. Filter by provider type, review an application, use Next applications to continue, and First applications to restart. Filter submission resets the page. History and private onboarding access remain separate protected actions.

GET /api/v1/admin/providers accepts kind (cinema/event/sports; empty or omitted means all), and paired afterCreatedAt/afterId boundaries returned by nextCursor. Timestamps use UTC with exactly six fractional digits; preserve them without JavaScript Date conversion. Each page contains at most 20 items. A null nextCursor means no next page at the time of the query.

The queue orders by organization creation time, not latest submission time. It is live: reviewed applications disappear; earlier applications resubmitted while paging can be behind the cursor. Return to the first page to check for them. An empty later page is valid after concurrent review. Do not use the capped provider array in the legacy /api/v1/admin/reviews aggregate as a complete queue.

Migration 050 creates partial indexes. Run migrations using the normal migration service before starting the updated application. Tests use only isolated fixtures; no application or moderation grant is seeded in the local deployment. Evidence prefix: docs/evidence/provider-queue-. Browser/accessibility and load acceptance remain open.
