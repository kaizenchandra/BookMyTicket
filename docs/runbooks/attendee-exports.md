# Attendee exports

## Scope and authorization

From `/partner/venues`, select an organization and open an occurrence's **Secure attendee exports** panel. An organization owner selects a historical form version, explicit fields, an operational purpose and confirms the scope. Confirmed registrations only are included. A recent MFA session is required to request or download; the profile screen provides authenticator verification. Status lists the requester's latest 30 jobs and polls queued jobs while the panel is open.

`POST /api/v1/attendee-exports` requires an actor-scoped idempotency key. Repeating identical input returns the original job; changed input returns a conflict. `GET /api/v1/occurrences/:id/attendee-exports` lists current status. `GET /api/v1/attendee-exports/:id/download` rechecks authorization and expiry and returns a private, no-store attachment. Errors remain errors: a queued/failed job is never presented as a generated file.

The worker verifies current active account, owner membership and provider approval. Revocation can prevent both generation and subsequent download. Downloads already delivered cannot be revoked from a recipient's device. Avoid entering attendee information in the purpose field; protect and delete downloaded files according to approved policy.

## Configuration and recovery

Configure `EXPORT_ENCRYPTION_KEY` or `EXPORT_ENCRYPTION_KEY_FILE`, never both: 32 random bytes encoded as 64 hexadecimal characters. Local Compose setup generates an ignored `export_key` file without printing it. `REGISTRATION_ENCRYPTION_KEY` is also required to decrypt source registrations. Securely preserve both keys with encrypted backups. Do not rotate either by blindly replacing its value; key-versioned rotation is not yet implemented.

Jobs are committed before request success. Workers take one job in a bounded database transaction using `FOR UPDATE SKIP LOCKED`. A process crash rolls back work; a subsequent worker can retry the queued job. Handled failures retain only a safe error code; retries are 30 seconds apart and stop after three attempts. Forbidden/invalid-scope/oversized jobs fail immediately. Correct configuration or authorization before making a new explicit request; there is no administrative force-replay endpoint. Do not manually mark a job ready or bypass permissions.

`EXPORT_UNAVAILABLE`: check the dedicated key configuration without printing its value. `REGISTRATION_UNAVAILABLE`: check the source-registration key. `EXPORT_PROCESSING_FAILED`: inspect safe application/database diagnostics and restore matching keys if needed. `EXPORT_TOO_LARGE`: the current slice cannot fulfill this scope; do not treat it as a successful truncated export. Broader large-export support remains required.

Development limits: five queued jobs per actor, one occurrence/form version per export, at most 1,000 registration records and 2 MiB CSV, 24-hour lifetime from request. Database-time expiry denies a download before cleanup. The worker clears expired ciphertext in batches of 100. Job metadata and audit retention still need production policy and deletion workflows. Freshness is the recorded generation time; this is an operational snapshot, not live admission verification.

## Verified scope

`tests/exports.test.ts` exercises real PostgreSQL and application components, including HTTP MFA gates, changed-input retries, selected-field exclusion, CSV formula protection, duplicate workers, permission changes during execution, account suspension, expiry, encrypted-artifact binding and bounded recovery. Isolated capture-input fixtures are not payment-provider verification. Full suite: 72 native and Linux-container tests, zero failures; 23 local deployed HTTP checks. Restart and separate fixture-database restore include form/registration/export record counts. Fixture keys are ephemeral, so that restore does not prove historical key recovery or decryption. Browser, visual and accessibility acceptance are still unverified.
