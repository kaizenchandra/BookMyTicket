# Saved listing revisions

Open an existing listing-history link from a catalog editor or moderator queue, then choose Load saved revisions. The panel is available on both /partner/listing-history and /admin/listing-history. It includes retained draft/submission/review snapshots, including rows predating the durable decision feed.

Each entry shows content before a change. It does not indicate the current listing or necessarily identify which operation followed. Recorded reasons may be absent; moderator actor references may be Not recorded. Do not infer approval or publication from a revision's saved state. Core title, description, city, kind and state are exposed, plus the allowlisted saved category details added in v0.56.0. Unrelated metadata remains omitted. See [category revision scope](category-revision-history.md).

GET /api/v1/listings/:id/revisions requires current organization membership. The /api/v1/admin/listings/:id/revisions variant requires moderation permission and MFA. beforeId is a positive decimal bigint string, bounded to 9223372036854775807. Preserve it as a string; never convert cursors through JavaScript Number. Each page contains at most 20 rows.

Migration 053 indexes history and makes revision rows immutable. Use normal migration/deployment commands. Do not edit/delete revisions as conflict recovery; current edits use the existing versioned workflows. Approved retention/remediation processes remain future work. Audit failures fail the read rather than disclose unrecorded access.

Evidence prefix: docs/evidence/listing-revisions-. Browser/navigation/accessibility acceptance, structured comparison/restore and unsupported category-field history remain open.
