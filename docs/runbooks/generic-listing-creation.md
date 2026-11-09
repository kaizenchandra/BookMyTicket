# Generic listing creation recovery

POST /api/v1/organizations/:id/listings now requires `Idempotency-Key` (8–100 characters). Generate a new key for an intentional new listing; retain it and the request payload until the outcome is known. Identical retries by the same actor in the same organization return the original listing. Changed content under that key returns IDEMPOTENCY_CONFLICT. Do not rotate keys to work around an unknown outcome.

The browser creates and retains the key automatically. If creation fails or the response is lost, use Retry original creation. Editing new-listing fields while recovery is pending does not replace its original payload. Recovery asks before resetting later form changes. Clear creation recovery only after checking whether the listing already exists; a subsequent new key intentionally creates another listing.

Replay requires current writable membership and does not change later edits, submission or publication. The response may be historical; check the refreshed listing status. Actor and organization scope are independent, so sharing a key with another actor does not recover the original actor's command.

Migration 056 persists immutable input/result mappings atomically with listing creation. No mapping expiry or historical backfill is implemented. Existing unkeyed API clients must add the required header. Category-specific creation APIs retain their established key contracts.

Evidence prefix: docs/evidence/catalog-create-retries-. Browser recovery/confirmation/accessibility, browser-close key persistence and approved retention remain open. Browser attempts are currently in memory; after closure inspect listings before creating again.
