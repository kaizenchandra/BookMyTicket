# ADR 027 — Customer escalation of unresolved support cases

Scope: FE:SUP-C-07, with FE:SUP-C-04/05 and BE:SUP-02/06 subsets.

Customers can request escalation from /cases with a required 10–2000 character reason. Only the authenticated case owner can execute the command. Open and in-progress cases transition to escalated and become unassigned, matching the existing support escalation queue. Already escalated cases explain that state; resolved cases require a follow-up reply to reopen first. No response-time guarantee is fabricated.

The command includes expected version and an actor-scoped idempotency key. The transaction serializes owner commands and locks the owned case, verifies prior fingerprint/outcome, validates state/version, then saves the transition, customer-visible reason message, audit and command result atomically. Same-key replay returns the original outcome without undoing subsequent staff changes. Staff claim/reply/resolve and customer escalation serialize on the same case row. Changed input under a reused key and stale versions conflict.

The case list exposes its version. The UI offers clear explanation, secret/OTP warnings, live status/error feedback, refresh and retry, and reuses the key for identical requests while mounted. Customer replies refresh parent status so reopened cases can be escalated. Private case state is keyed by account. Existing theme components and semantic forms are reused; interactive accessibility is not claimed without browser verification.

Migration 032 is additive; command records have no automatic expiry. Reasons are stored in the case conversation; audit references the message rather than duplicating the reason. Escalation does not send external notifications, change booking/refund eligibility or impersonate a staff member. Repeat escalation after subsequent staff handling follows current case state/version; configurable anti-abuse thresholds and broader operational policy remain outstanding.

Tests use real HTTP/PostgreSQL components for ownership, input validation, six concurrent retries, one message/audit, mismatched keys, already-escalated/resolved cases, staff races and replay after a later claim. Browser tooling is unavailable; screen-reader, keyboard, responsive and visual acceptance remain pending.
