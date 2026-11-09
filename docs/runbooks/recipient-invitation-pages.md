# Recipient invitation pages

Sign in with the invited email and open Invitations for your verified email in /partner. Use Next page for older invitations, Previous page to retrace navigation, and First page for newly received invitations. Accept invitation uses the existing current-state checks. Accepted, expired and revoked invitations disappear from the inbox; acceptance does not extend validity.

GET /api/v1/provider-invitations returns up to 20 items plus nextCursor. To continue, send both afterCreatedAt and afterId from nextCursor unchanged, preserving all six timestamp fractional digits and URL-encoding values. Stop at null. Clients relying on the former 100-item response must now paginate. Records are always scoped to the authenticated contact; no contact query parameter is supported. Recipient access does not require owner MFA.

Migration 062 adds the pending-recipient page index. No seed or new grants are required. Pages are live rather than a frozen snapshot: records may disappear between requests. Empty later pages can be navigated back. This does not add invitation email delivery or resend.

Evidence prefix: docs/evidence/recipient-pages-. Browser navigation/accessibility, member pagination, delivery/resend and load acceptance remain open. See ADR 069.
