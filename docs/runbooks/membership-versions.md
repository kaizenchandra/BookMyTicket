# Exact membership versions

The staff workspace now preserves membership versions as decimal strings when changing roles or revoking access. No operator setup or migration is needed.

API clients should copy the version string from GET /api/v1/organizations/:id/staff directly into PUT /api/v1/organizations/:id/staff/:accountId. Do not parse it as a JavaScript Number. Strings must be canonical positive decimals no greater than 9223372036854775807. Small positive safe-integer numbers remain supported for compatibility; unsafe numbers and malformed strings return 422. A valid but stale version returns 409 and requires refreshing current membership.

Authorization, fresh owner MFA, protected ownership and versioned role/revocation transactions remain unchanged. Invitation versions use their existing integer contract. No database sequence changes, seed or new grants are required.

Evidence prefix: docs/evidence/membership-versions-. Browser role/revocation acceptance remains unverified. See ADR 070.
