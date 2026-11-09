# Invitation status filters

In /partner, open Manage staff and invitations as an owner with fresh authenticator verification. Choose All statuses, Pending, Expired, Accepted or Revoked under Invitation status. Changing the selection starts invitation navigation at page one and preserves the member page. Statuses refresh when pages load; expired or revoked records leave the pending view.

GET /api/v1/organizations/:id/staff accepts optional invitationState with one of pending, expired, accepted or revoked. Omit it for all records. Keep the same filter with afterCreatedAt/afterId while paging, and clear those invitation boundaries when changing filters. afterMemberId is independent. Unknown and empty status values return 422. The recipient inbox does not accept this parameter.

Pending/expired boundaries use authoritative statement time. Accepted and revoked records retain their terminal status after their expiry timestamp. No migration, seed or new grants are required. Existing invitation recovery and version checks remain in force.

Evidence prefix: docs/evidence/invitation-filters-. Browser filter/navigation/accessibility and load acceptance remain unverified. See ADR 074.
