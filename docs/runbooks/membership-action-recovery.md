# Staff membership action recovery

Use the existing role-change or revoke-access controls in /partner. After an uncertain response, Retry original membership action resends the original target, exact version and action. It does not change a later role or a replacement membership. Dismiss membership recovery clears the attempt; review current staff before another action. Successful recovery refreshes current lists.

PUT /api/v1/organizations/:id/staff/:accountId retains its version/role body. Same-actor identical commands recover their original accountId/role result; changed actor/action returns 409. Current owner access and fresh MFA remain required. The result describes the original command, so fetch current membership afterward. New actions retain protected-owner and exact-version checks.

Apply migration 064 before serving this release. Old commands have no durable recovery record and may conflict; refresh current staff. Do not remove immutable records to retry. No seed or grants are needed.

Recovery is memory-only and clears on session/organization change or unmount. Evidence prefix: docs/evidence/membership-recovery-. Browser recovery/accessibility and approved retention remain open. See ADR 073.
