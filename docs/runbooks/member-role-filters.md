# Member role filters

Open Manage staff and invitations in /partner as an owner with fresh authenticator verification. Choose All roles, Owners, Editors or Viewers under Member role. Changing the role starts member navigation at page one and preserves invitation filters/pages. Role changes refresh the view and may move the affected member out of it.

GET /api/v1/organizations/:id/staff accepts optional memberRole=owner|editor|viewer. Omit it for all roles. Keep the filter while following nextMemberCursor.afterMemberId; clear the member boundary when switching roles. Invitation boundaries and invitationState remain independent. Empty/unknown roles return 422, and recipient inbox queries reject memberRole.

Role filtering does not change permissions. Owner accounts remain protected from staff role/revoke controls, and exact version/MFA checks still apply. No migration, seed or grants are needed.

Evidence prefix: docs/evidence/member-filters-. Browser filter/navigation/accessibility and load acceptance remain unverified. See ADR 075.
