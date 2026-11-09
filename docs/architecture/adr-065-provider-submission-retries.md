# ADR 065: Durable provider submission recovery

FE:PRV-03/06 and BE:PRV-02 require resumable onboarding and corrections. POST /api/v1/organizations/:id/submit continues to accept the existing bounded integer version. The organization/input-version pair identifies a business submission; its recorded actor must match on retry.

Migration 058 adds immutable providers.submissions with a primary key on organization/input version, actor attribution, output version and original JSON result. The existing Providers application use case remains the entry point. Its PostgreSQL adapter locks the organization then current owner membership, checks for an existing submission, and returns its original result only to the original actor with current ownership. A different owner receives SUBMISSION_CONFLICT. Authentication remains enforced at the HTTP boundary.

For new submissions, editable state, expected version and complete private onboarding remain mandatory. The state/version update and submission record commit in one transaction. A failed record insert rolls back the transition. The organization lock serializes concurrent submissions and review/edit transitions; no external I/O occurs inside this transaction.

Historical retries run before current-state validation, perform no writes and cannot resurrect a submitted state after corrections, approval or other later transitions. They do not resubmit current unsaved changes. Immutable records have no automatic expiry. Existing pre-migration submissions are not backfilled and cannot be reconstructed reliably; their old next-version shortcut is removed. Owners must refresh current state when such an old retry conflicts.

The frontend captures original organization/version before submission, preserves that attempt on failure, and offers Retry original provider submission and Dismiss submission recovery. New submissions are disabled while recovery is pending. Successful recovery refreshes current server state rather than applying a historical response over current data. Session changes clear attempts; stale responses after session change/unmount are ignored. Recovery is memory-only.

Tests cover six concurrent identical requests, one durable record, rollback under injected durable-write failure, bounded versions, incomplete onboarding, actor conflicts, corrections/edit/resubmission/approval replay, current ownership revocation and immutability. Browser interactions/accessibility, reload persistence and retention approval remain open.
