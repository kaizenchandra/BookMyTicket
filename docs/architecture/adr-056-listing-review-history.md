# ADR 056: Listing moderation decision history

FE:CAT-06, FE:ADM-UI-05 and BE:CAT-07 require visible moderation reasons and history. GET /api/v1/listings/:id/reviews exposes durable decision history to current organization members (owner, editor and viewer, matching catalog read access). GET /api/v1/admin/listings/:id/reviews requires current platform moderation permission and the existing route MFA policy. Catalog owns the use case and query; Providers supplies membership authorization through its public contract.

Reads run in a transaction. Moderator authorization is rechecked using Identity's StaffAuthorization contract; the listing is held with a shared lock and organization membership is checked under the Providers contract's shared lock. The access audit commits with the read. If auditing fails, no history result is returned. Audit details contain audience, page and count, not reasons or listing snapshots.

Responses contain decision, reason, input/result versions and database timestamp. Only moderator responses include reviewer UUID. Stored original result snapshots, metadata, descriptions and contact data are not returned. Current members retain read access for corrections even if the provider is not approved; this does not grant publication or editing permission.

Pages contain at most 20 decisions, descending by input version. beforeVersion uses the prior page's resulting version, converted to an exclusive input-version boundary. The existing decision primary key supports the ordered lookup, so no new migration is required. Versions are unique per listing. These are historical decisions, not the current listing state.

The generic and category catalog editors link to /partner/listing-history?listingId=UUID. The moderator queue links to /admin/listing-history?listingId=UUID and offers standalone lookup for listings no longer in the queue. Each page explicitly loads history, clears it on session changes, and offers latest/older navigation with loading/error/empty states. Reasons render as text; reviewer UUID appears only when supplied by the moderator endpoint.

Only decisions persisted since migration 052 are shown. Earlier moderation records and non-decision draft revisions remain outside this view; the full revision-history requirement is still partial. No invented legacy attribution, snapshot backfill or public exposure is introduced. Browser/navigation/accessibility acceptance and approved retention remain open.

Tests cover an empty history, 22 real review/resubmission cycles, 20+2 pagination, response schema, member/viewer access, unauthenticated/outsider denial, moderator identity projection, stored-snapshot omission, malformed cursors, membership/grant revocation, access audit metadata and audit-failure withholding. Initial-render checks verify explicit loading and the historical-scope notice; they do not constitute browser acceptance.
