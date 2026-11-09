# ADR 074: Owner invitation status filters

FE:PRV-09 and BE:API-05 require manageable invitation lists and filtering. The staff endpoint now accepts optional invitationState=pending|expired|accepted|revoked. Omission returns all statuses. Unknown/empty values are rejected; the recipient inbox continues rejecting this owner-only filter.

The adapter applies status filtering before cursor comparison and the 21-row page probe. Pending invitations whose expiry is at or before statement_timestamp() are classified as expired. Both projection and filtering use the same authoritative statement time, avoiding inconsistent boundary classification. Accepted/revoked records retain their terminal state regardless of expiry. Existing owner/MFA checks, organization scope, tuple ordering and member pagination remain unchanged. No migration is required.

The owner panel adds an Invitation status selector. Changing it resets only invitation cursor history, preserving member position. Session and organization changes clear the filter. Page navigation keeps the filter, mutations refresh the current filtered page, and empty results describe the active filter. Views remain live: expiry and revocation can remove records between requests.

Tests cover all four states, pending pagination, terminal-state classification after expiry, revocation/expiry movement between filters, unchanged member results, invalid inputs, outsider denial and recipient API rejection. Browser filter/navigation/accessibility and load acceptance remain open.
