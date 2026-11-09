# Organization creation and recovery

In /partner, sign in and enter an organization name and type. Save onboarding draft creates the organization and its owner membership atomically. The first-party form supplies the required Idempotency-Key automatically.

If the response fails, use Retry original organization creation. The form retains the original details and key until resolved. Successful recovery displays the original organization reference and refreshes current state, which may have advanced since creation. Check existing organizations before confirming Clear creation recovery and starting a new attempt. Recovery is memory-only; reload, navigation away or session change loses it.

API clients must send a stable 8–100 character Idempotency-Key with POST /api/v1/organizations and reuse the same normalized name/kind for retries. Changed input returns 409; invalid/missing keys return 422. Keys are actor scoped. Recovery requires an active account and current owner membership; it never regrants access. The returned creation state is historical, so fetch the current organization list afterward.

Apply migration 057 through the existing migration service. Do not delete immutable creation mappings to retry an operation or attempt to reconstruct pre-migration keys. The demo seed uses deterministic organization creation keys with the public active-account contract; this release did not run the seed or create new application grants.

Evidence: docs/evidence/provider-create-retries-{tests,full-suite,container-tests,build,deploy,smoke}.txt. See ADR 064 for transaction and authorization rules. Browser recovery/accessibility and retention approval remain open.
