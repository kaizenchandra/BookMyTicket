# ADR 064: Organization creation recovery

POST /api/v1/organizations requires an Idempotency-Key of 8–100 characters. Transport validation trims the name and validates organization kind. Existing clients must supply the header; missing or invalid keys receive 422. Previously unkeyed creations cannot be recovered by this mechanism.

Migration 057 adds immutable providers.creations records scoped by actor and operation key, with a unique organization reference. The dedicated creation application port is implemented by a PostgreSQL adapter. Within one local transaction, the Identity ActiveAccount public contract checks and locks current account eligibility, an advisory transaction lock serializes the actor/key, and organization, owner membership and original input/result mapping commit together. Failure rolls all three back. JSONB equality compares normalized input; changed payloads return 409. Different actors have independent scopes.

Replay requires both an active account and current owner membership. It returns the original result without restoring membership or changing later organization edits, onboarding or approval. Immutable mappings have no automatic expiry; retention policy remains outstanding. No other module's private repository is imported.

The provider form generates a UUID for each new attempt and retains its exact input/key after failure. Fields stay locked while unresolved, with explicit original-request retry and confirmed clearing controls. Success refreshes current organization state. Session changes and unmount invalidate stale responses; session changes clear recovery. Recovery is held in memory and is lost on reload or browser close.

Integration tests cover six concurrent identical requests, atomic rollback after mapping failure, validation, normalized replay, payload conflicts, actor isolation, later rename/onboarding/approval, membership downgrade/removal, suspended accounts and immutable records. Browser interaction, accessibility, cross-reload recovery and approved retention remain unverified or unimplemented.
