# Operator administration

Version 0.96.0 adds [FR-03 admin creation and persistent roles](admin-roles.md), superseding earlier limitations below concerning custom roles and administrator creation. Existing OTP/MFA authentication remains in use.

Local entry points: `/admin/dashboard`, `/admin/users`, `/admin/customers`, `/admin/bookings`, `/admin/payments`, `/admin/refunds`. Existing approvals, pricing, support and audit remain linked through permission-aware navigation. Sign in through the existing verified-contact flow and complete authenticator MFA in Profile. This increment does not introduce password/SSO authentication.

| Screen / operation | Platform permission |
| --- | --- |
| Staff directory and account/grant mutation | access.manage |
| Customer account directory | customers.read |
| Booking directory, details and payment history | bookings.read |
| Dashboard, payment attempts, recovery cases | finance |
| Existing review, pricing, support, audit | moderate, pricing, support, audit respectively |

No application account receives privileges automatically. An authorized deployment/database operator must provision the first access.manage grant for a specifically approved, verified account. Use controlled database administration under the deployment operator’s authorization; do not expose a self-service bootstrap endpoint or add demo grants. Subsequent assignments can be made through Staff access. To appoint an existing customer, enter their exact account UUID in Staff access even if they have no current staff grant.

Search exact registered contact or UUID; returned contacts remain masked. Customers includes all registered accounts, including staff and partners. Changes require a reason, explicit confirmation and the loaded version. If another administrator changed the account, reload before retrying. Self-modification is forbidden. Status and managed permission changes revoke every target session; the target must sign in and perform MFA again. Customer directory status actions require access.manage in addition to customers.read. Gate/tenant-scoped and unrecognized platform grants are retained.

Bookings: filter reference, customer, current state, creation timestamps with explicit offsets or ever-confirmed cohort. Results show newest first, 25 per page. Changing filters/account invalidates the cursor. Detail shows only safe booking fields, recorded milestones, ticket validity counts and paginated payment events. It does not expose customer QR credentials or execute cancellation/refund actions.

Payments lists latest provider attempt states. Refund recovery lists recorded obligations, not completed refunds. No refund approval button or fabricated success state is provided. Payment/booking/ticket states are intentionally separate. Dashboard presets include today/yesterday/7/30 calendar days in IST, including today; custom end date is exclusive and range is at most 366 days. Dashboard includes demo records.

Migration: use existing `npm run migrate` before running version 0.94.0. Apply normal backup/maintenance policy for index creation on large production tables. Read-only report queries currently use authoritative tables; production-scale projection and load validation remain outstanding.

Coverage and remaining work: [admin requirement register](../requirements/admin-traceability.json), [ADR 097](../architecture/adr-097-admin-operations.md). Broad travel supplier products, password/SSO and invitations, custom role lifecycle, refund execution, paid cancellation, commissions/settlements, promotions, report scheduling and platform configuration are not completed by this increment. Existing modules require separate clause-level acceptance rather than blanket claims. No browser visual/accessibility verification is claimed.
