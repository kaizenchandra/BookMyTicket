# Private onboarding save recovery

Open private onboarding in /partner, edit business/contact fields and save. Incomplete drafts remain supported; submission still requires the configured mandatory fields.

If saving or refreshing fails, Retry original private onboarding save resends the captured details/version. Different fields entered afterward remain unsaved and are not included in that retry. Success reads current details, preserving different entries. Dismiss onboarding recovery allows a deliberate new attempt; resolve version conflicts by reviewing/reloading current saved data. Reload confirms before discarding unsaved fields. Pending recovery blocks submission through the parent dirty-state control.

API callers keep PUT /api/v1/organizations/:id/onboarding with the five detail fields and expectedVersion. Identical normalized input from the original actor recovers the original result even after later review. Changed input/actor returns 409; revoked ownership returns 403. Read current details afterward, since replay state/version is historical. Private reads and recoveries are audited without field content; audit failure withholds the response.

Migration 060 stores a fingerprint and original version/state metadata, not duplicate contact payloads. Existing pre-migration saves cannot be reconstructed; refresh after a legacy conflict. Do not delete immutable mappings to retry. No seed or application grant changes are needed.

Recovery is memory-only. Session, organization and reviewer-mode changes clear loaded private data and attempts; unmount invalidates pending responses. Browser/session/accessibility acceptance and retention approval remain open. Evidence prefix: docs/evidence/onboarding-save-retries-. See ADR 067.
