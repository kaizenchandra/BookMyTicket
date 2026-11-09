# Organization name draft recovery

In /partner, an owner can edit an organization name while its state is draft or changes requested. Save draft changes retains the original organization/name/version until both the save and current-state refresh succeed.

After an error, Retry original organization draft save resends the captured input. It does not submit different text entered afterward and cannot overwrite later saved edits or approval. Successful recovery reads the current organization and preserves a different entered name as unsaved text. Reload saved organization explicitly discards entered text after confirmation. Dismiss draft recovery allows a deliberate new save; review current state first.

API callers continue PUT /api/v1/organizations/:id/draft with name and expectedVersion. The normalized name and original actor must match the durable result for that organization/version. Changed payload or another owner receives 409; revoked ownership receives 403. New edits retain state/version checks. Replay results are historical; read current organizations afterward.

Apply migration 059 before serving this release. Pre-migration edits have no replay records; refresh after a legacy version conflict. Do not delete immutable mappings to retry. No seed or new application grants are needed.

Recovery is memory-only and clears on session change or unmount. Evidence prefix: docs/evidence/provider-draft-retries-. Browser interaction/accessibility and private onboarding-detail save recovery remain open. See ADR 066.
