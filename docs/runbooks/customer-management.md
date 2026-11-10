# Customer management (FR-04)

Open `/admin/customers` with `customers.read` and fresh MFA. Search profile name, exact email/phone or account UUID; filter registration/status and booking activity. Dates accept timezone-qualified ISO timestamps, e.g. `2026-11-01T00:00:00+05:30`. End dates are exclusive. Activity windows require a specific activity selection. Counts shown in the directory/detail are all-time, even when filtering a narrower window. First/next page links preserve the selected filters.

Open a customer to view profile completeness, masked verified-contact evidence, flags and consent-aware saved attendees. Booking, payment and support histories have independent permissions and pages. Payment capture/attempt/recovery entries are observations: do not sum them as revenue or infer completed refund amounts. Support links open the existing operations workspace. Wallet and loyalty are not supported.

Status and flag changes require `access.manage`, a reason, the displayed version and explicit confirmation. Saves revoke all target sessions, including flag-only saves. Self changes and last-manager removal are denied. On a stale-version error, reload and review the current account before trying again. The status endpoint cannot assign permissions or edit verified contact data. Reads and changes are audited.

Deploy migration 075 using the existing migration process before starting the new application. Existing accounts keep null verification times until successful OTP; historical consumed challenges are separately labelled. If saved attendees show unavailable, verify the existing `REGISTRATION_ENCRYPTION_KEY` through the established secret configuration process; do not replace a key to bypass errors. Withdrawn consent returns no attendee data.

Verification: `tests/customer-administration.test.ts` covers filtering/pagination, per-history authorization, masking/consent, status concurrency/version protection and revocation. Existing identity/profile/account suites cover OTP, last-manager safeguards and audit rollback. Browser acceptance and production-scale load testing remain outstanding.
