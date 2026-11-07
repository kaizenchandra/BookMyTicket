# ADR 012 — Verified-email organization invitations

Status: implemented locally; browser acceptance pending.

Provider Management owns invitations and membership roles. Identity supplies the authenticated account and verified contact. Reporting receives audit entries through its public port. No provider adapter reads or mutates private identity tables.

Organization owners with fresh MFA may create, list and revoke invitations, change editor/viewer roles and revoke non-owner memberships. Membership ownership is rechecked in the same transaction as each mutation. Ownership transfer is deliberately a separate, still-unimplemented controlled workflow. Recipients accept with the authenticated verified email matching the invitation; invitation IDs alone confer no authority.

Invitations have a seven-day development default expiry checked against database time. They are presented in the partner portal inbox, not emailed. The UI explicitly states that no invitation email is sent. Delivery/resend and production-configurable expiry remain requirements. Owners may revoke an invitation and issue a replacement; valid duplicate invitations to the same email/organization are rejected.

Create requests use an owner/organization-scoped idempotency key and compare canonical email/role. Identical retries return the original invitation, including its original expiry; changed input conflicts. Acceptance is serialized by organization then invitation. Concurrent acceptance grants one membership. Accepted retries return the original accepted outcome without restoring access after membership revocation. An existing membership cannot be overwritten by an invitation.

Role changes require the current membership version. Migration 017 assigns versions from a shared monotonically increasing sequence; deleting and recreating a membership never reuses its old version. Thus stale screens cannot revoke a newly accepted membership. Owner roles cannot be altered through this API. Invitation revocation uses its own expected version.

Invitation acceptance, revocation and membership mutation share an organization lock and audit in the same transaction. Existing module writes continue to enforce their own member permissions; those already protected by membership locks serialize with revocation. This slice does not claim every legacy in-flight operation revalidates at commit. Subsequent requests use current membership; export permission checks remain in their existing worker/download use cases.

The UI clears private invitation/staff data on identity changes and scopes each staff panel to an organization. Owner lists expose account IDs rather than reading identity contacts across a module boundary. Inbox and invitation history return latest 100 records; complete pagination, invitation retention, friendly staff display names, granular venue/occurrence grants and delivery remain open.

Verification: real HTTP and PostgreSQL tests cover scoped owner access, fresh MFA, email matching, role downgrade, expiry, revocation, concurrent acceptance, accepted replay after revocation, permanent owner protection, changed-input keys and stale membership versions after reinvitation. Fixtures are confined to bookmyticket_test. No external invitation email or live provider onboarding is claimed.

Migration 017 is additive. Retain its sequence and data on rollback; do not reset membership versions. Release recovery uses a compatible artifact or an isolated tested backup restore, not destructive migration reversal. Production recovery acceptance remains pending.
