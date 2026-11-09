# Listing moderation history

Organization members can open View moderation reasons and decisions from catalog, cinema or sports editor cards. The destination is /partner/listing-history?listingId=UUID. Moderators use View decision history from /admin/listings, or Find past listing decisions to look up a listing that has left the queue.

Choose Load review history. Pages show newest decisions first, with reason, time and input/resulting versions. Older decisions continues; Latest decisions and Refresh latest decisions restart the history. The moderator view includes reviewer references. Organization members do not receive reviewer identity or stored original listing snapshots.

History is not current publication status. Only durable decisions recorded since migration 052 appear: older moderation records and ordinary draft edits are omitted. An empty history does not prove that the listing was never reviewed. Full revision-history coverage remains open.

GET /api/v1/listings/:id/reviews requires current organization membership; GET /api/v1/admin/listings/:id/reviews requires moderation authorization/MFA. Both accept optional positive integer beforeVersion and return up to 20 items with nextCursor. Read access is audited; failed audits fail the read. Revoked membership or permission requires restoring legitimate access, not bypassing the API.

No new migration or application fixtures are needed for this increment. Evidence prefix: docs/evidence/listing-review-history-. Browser/navigation/accessibility and retention acceptance remain open.
