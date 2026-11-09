# Audit history

Open /admin/audit (linked from Administration). Sign in with an existing authorized platform audit account and verify MFA in account security. This change does not provision or grant staff access.

Filter by exact actor UUID, action name or target identifier, optionally bounding time with ISO timestamps and explicit offsets. From is inclusive; Until is exclusive. Times in results are UTC. Clear filters resets the search. Older records traverses 50 records per page; Refresh first page includes newly recorded entries.

A missing outcome is displayed as Not recorded. Raw details JSON is intentionally excluded, including reasons that may contain personal data. A null actor is not proof of a particular system process. Interpret records alongside authorized operational evidence.

A cursor error means filters/account changed or the cursor is malformed; refresh the first page. Forbidden/MFA errors require current audit permission and fresh MFA. Each page rechecks authorization. Do not grant broad permissions solely to work around an error.

Migration 029 creates indexes only. Prior application artifacts can run against this additive migration during rollback. Do not drop immutable audit history or modify its rows to repair display problems. Index creation on a large production table needs a separately planned migration window; no production-scale timing is claimed.

Verified locally with isolated PostgreSQL/HTTP and Docker tests; browser interactions remain unverified. See docs/progress.md and ADR 024 for remaining audit coverage.
