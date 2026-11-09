# Reviewing staff directory access

Successful supervisor searches now record identity.support_directory.read. Authorized auditors with fresh MFA can filter /admin/audit by that action and the supervisor's account UUID. Each page/search is a separate access, including searches with no matches.

Audit storage records returned account UUIDs (at most 25), result count, older-page/has-more indicators and success outcome. It excludes search text, contacts and cursors. The audit UI continues to expose metadata only; it does not expose raw details or returned account identifiers. Use existing approved audit investigation procedures when deeper analysis is needed.

If an audit write fails, the directory request fails and returns no results. Retry after restoring the audit dependency; do not bypass auditing or create alternate staff grants. Earlier searches are not backfilled. Failed authorization and malformed input do not create successful-access records.

No migration, credentials or new permissions are required. Existing tests/support-assignment.test.ts and full native/container commands verify paging, redaction, current permissions and audit-failure rollback. Approved retention, denied-access logging, controlled exports and browser acceptance remain outstanding.
