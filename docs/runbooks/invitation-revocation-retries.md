# Invitation revocation recovery

Owners with fresh authenticator verification can revoke pending invitations in /partner. If the response fails, use Retry original invitation revocation. It reuses the original invitation/version and cannot affect a replacement invitation. Dismiss revocation recovery clears the local attempt; check current status before starting another action. Successful recovery refreshes the lists.

API callers retain POST /api/v1/organizations/:id/invitations/:invitationId/revoke with version. Identical original-actor retries return the original id/revoked result. A different actor/version returns 409; missing current ownership or MFA returns 403. New revocations still require a matching pending invitation. Version must be a positive integer no greater than 2147483646.

Apply migration 063 before serving the release. Do not delete immutable mappings to retry. Older revocations have no recovery record and may conflict; refresh their current status. No seed or new application grants are needed. Recovery does not resend emails or change membership.

Attempts clear on session/organization change or unmount and do not persist across reload. Evidence prefix: docs/evidence/invitation-revocation-. Browser retry/accessibility and retention approval remain open. See ADR 072.
