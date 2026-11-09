# Compare saved listing revisions

From either listing-history page, load saved revisions. Choose Use as From revision on one card and Use as To revision on another. Selections remain while loading older/latest pages; references may also be entered directly. Choose Compare revisions to view changed fields side by side.

The comparison is directional and limited to core content and the [supported saved category details](category-revision-history.md). Not recorded means null/missing; Empty text means a saved empty string. No differences means only these compared fields match. Both records are snapshots from before changes, not the current listing. This operation never restores, edits or publishes content.

GET /api/v1/listings/:id/revisions/compare?fromId=ID&toId=ID is available to current organization members. The /api/v1/admin/listings variant requires moderation permission/MFA. References must be distinct positive decimal strings within PostgreSQL bigint range. Preserve them as strings. Both must belong to the specified listing; foreign/missing revisions return 404.

Auditing is mandatory and contains references/field names only. Retry a failed read after the underlying access/audit problem is resolved. Session changes clear selections; comparison content is not persisted in browser storage.

No new migration is required beyond migration 053. Evidence prefix: docs/evidence/revision-comparison-. Browser/navigation/accessibility acceptance, unsupported category-field comparison and restoration policy remain open.
