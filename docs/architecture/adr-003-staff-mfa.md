# ADR-003 — Authenticator MFA and session step-up

Status: implementation, browser/authenticator-device verification pending.

Use RFC 6238 TOTP with SHA-1 HMAC, 30-second periods, six digits and ±1 step validation. A counter may succeed only once per account even across sessions. Domain authorization still requires a current role/scope grant; MFA never grants a role. Enrollment starts from an authenticated, verified-contact account. Replacing an active factor requires recent MFA or a single-use recovery code. A pending replacement does not destroy the current factor.

Store secrets encrypted using AES-256-GCM and a dedicated environment key, with account ID as associated data. Setup secrets are returned only by the initiating authenticated enrollment request, never in URLs, logs or later status reads. Keep them only in current UI memory. Recovery codes have 128 bits of entropy, are returned once, stored as SHA-256 hashes and consumed atomically. Losing all recovery codes requires a separately controlled recovery process; there is no email-only MFA bypass.

Five failed verifications per account in a five-minute window lock further attempts for that window. Enrollment does not reset failures. All factor/counter/recovery updates lock the account MFA row and recheck the current session/account inside the transaction. MFA elevation lasts 30 minutes and is bounded by session expiry. Replacing a factor revokes other sessions. Existing sessions without a fresh MFA timestamp cannot access staff operations.

Sources: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226). RFC test vectors verify the algorithm implementation; they are not evidence of end-user authenticator compatibility or production certification.
