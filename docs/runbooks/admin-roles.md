# FR-03 admin users and roles

Open `/admin/users` and `/admin/roles`. Every operation requires an active account with platform `access.manage` and current authenticator MFA. Initial access-manager provisioning remains an explicitly authorized deployment operation; this feature grants no account new access automatically.

## Administrator workflow

Create an administrator with their email, admin display name, one or more roles/direct permissions and a reason. No invitation is sent. The recipient uses the existing email-verification sign-in and enrolls/verifies MFA before protected actions. No temporary password or pre-authenticated session is issued. Existing email addresses conflict; find the account by exact contact/reference and explicitly edit its access instead.

Search by admin name, exact email/reference, status, role reference or effective permission. Results are newest-first, 25 per page. Contacts remain masked. Edit display name, account status, assigned roles and direct permissions. Confirm before applying changes; all target sessions are revoked. Reload on version conflicts. Another access administrator must change your own account.

## Role workflow

Create/edit a named role with an explanatory description and the supported permission checklist. Initial unassigned definitions are Super Admin, Operations, Finance, Support and Content Manager. Role search supports name/status with server pagination. Assigned-account counts link to filtered users.

Role permissions combine with direct grants. Deactivation removes role-derived permissions from every assigned account but keeps assignments. Reactivation restores those permissions. Independently granted direct access remains effective; removing a role does not automatically suspend the account. All affected sessions are revoked after edits, and account versions change so stale account edits cannot silently overwrite new access. A role assigned to you, active or inactive, must be changed by another access administrator.

Supported actions: access.manage; customers.read; bookings.read; finance; support; support_assign (also needs support); moderate; pricing; audit. These map to existing enforced platform operations. Gate/tenant-scoped grants and unknown legacy platform grants are retained. This UI does not grant gate admission or tenant membership.

## Activity and contracts

Activity & privilege history shows reason, actor, target, time and before/after access, including shared-role changes that affected an account. It requires access.manage; broader audit exports remain a separate audit function. Arbitrary audit payloads and account contacts are not exposed.

- `GET/POST /api/v1/admin/users`; `PATCH /api/v1/admin/users/:id`
- `GET/POST /api/v1/admin/roles`; `GET/PATCH /api/v1/admin/roles/:id`
- `GET /api/v1/admin/users/:id/activity` accepts an account or role reference and optional cursor.

POST creation requires Idempotency-Key (8–100 characters). Retries with the same actor/operation/key return the original result; changed payloads conflict. PATCH requires expectedVersion and a reason. Mutation, session revocation and audit commit together. Apply migration 074 using the existing migration workflow before running version 0.96.0.

Verification: `tests/admin-roles.test.ts` plus existing account/booking/security tests. Browser visual, interaction and accessibility acceptance remains unverified. Invitation delivery, password/SSO and tenant-role administration are separate workflows and are not supplied by this release. The frontend build currently emits Vite's existing-size-threshold warning for the main bundle; build/type checking still succeeds.

## Access inspection and ordering (0.97.0)

Use **View administrator** to open `/admin/users/:id`. The page shows masked identity metadata, account status, assigned role definitions and the source of every effective platform permission. Inactive roles contribute no access. Suspended accounts cannot authenticate even if they retain assigned grants. Edit uses the existing confirmation, version and reason requirements; Reload retrieves fresh data after a conflict.

Admin and role searches support Newest first / Oldest first. Paging retains the current filters and sort; switching order starts a new cursor scope. Pre-0.97 cursors must restart from the first page. Case variants of the same UUID cannot bypass the self-change guard, and privilege history accepts either UUID casing.
