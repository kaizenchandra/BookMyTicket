# ADR 075: Member role filtering

FE:PRV-09 and BE:API-05 require manageable staff lists and filtering. The owner staff endpoint now accepts optional memberRole=owner|editor|viewer. Omission includes all roles; empty and unknown values are rejected. Recipient invitation endpoints continue rejecting owner-only query parameters.

The Providers adapter applies the role predicate before the ascending account-ID cursor and page limit. Organization scope, current owner/MFA checks, exact membership versions and protected-owner mutations remain unchanged. Invitation state/cursor queries do not depend on memberRole. Existing membership indexing supports the bounded scan; no migration is required and load acceptance remains open.

The frontend adds a Member role selector. Changes reset only member cursor history, preserving invitation status and position. Session/organization changes reset both filters. Successful actions refresh the current view, so changed/revoked members can disappear from it. Empty filtered pages have explicit feedback. Pages remain live, not a snapshot.

Tests cover all roles, editor pagination and unique ordering, unchanged invitation results, movement after role changes, combined independent filters/cursors, invalid inputs, outsider denial, recipient rejection and owner protection. Browser filter/navigation/accessibility and load acceptance remain open.
