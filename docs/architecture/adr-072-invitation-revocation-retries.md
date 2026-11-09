# ADR 072: Durable invitation revocation recovery

FE:PRV-09 and BE:PRV-08 require revocation and replay protection. POST /api/v1/organizations/:id/invitations/:invitationId/revoke retains its version body. Migration 063 records one immutable revocation per invitation with organization, original actor and input version. No contact payload is copied.

The existing application use case checks authentication/fresh MFA and the adapter locks the organization and current owner membership. Replay requires matching original actor/version; another actor or version receives REVOCATION_CONFLICT. Original retries return the same id/revoked result without repeating writes or audit events. Authorization is rechecked even on replay.

For a new command, invitation organization/version/pending state remain mandatory. The revoked-state update, durable mapping and audit event commit together; audit failure rolls back all three. Acceptance and revocation serialize through the same organization lock. A late retry cannot revoke a new invitation or remove membership granted through a replacement. Expired pending invitations retain their prior revocation policy. Input version bounds now prevent PostgreSQL integer overflow.

The staff panel captures the original revoke URL/body, preserves it after failure and offers original-request retry/dismissal. Other revoke buttons disable while recovery is unresolved. Success refreshes current lists. Session/organization changes clear recovery, and stale action/list responses are ignored; unmount invalidates action responses. Attempts remain memory-only.

Tests cover six concurrent retries, one mapping/audit event, audit rollback, bounded versions, actor/version conflicts, replacement acceptance safety, immutable records, accept/revoke races, lost MFA and ownership downgrade. Pre-migration revocations are not reconstructed. Retention, browser/recovery/accessibility and reload persistence remain open.
