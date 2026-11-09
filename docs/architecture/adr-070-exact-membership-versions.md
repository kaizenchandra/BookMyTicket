# ADR 070: Exact staff membership versions

FE:PRV-09 and BE:API-02/06 require reliable role management and version validation. Membership versions are PostgreSQL bigint sequence values, returned as decimal strings. The frontend previously converted them to Number and the persistence adapter compared Number(row.version), losing precision above 9007199254740991.

Staff role/revocation commands now carry canonical decimal strings from the UI through the application port to the database comparison. The transport schema accepts positive decimal strings up to 9223372036854775807, or legacy positive safe-integer numbers. Valid numeric inputs are converted to strings at the HTTP boundary. Noncanonical strings, out-of-range values and unsafe numbers are rejected with 422. Invitation versions remain their existing integer type.

Current owner/MFA, organization and member locks, owner protection and transaction/audit behavior remain in force. Exact stale versions return 409; version handling does not grant access or restore revoked membership. New role versions still come from the existing global sequence. No migration or sequence adjustment is required.

Tests cover exact API round-trip at 9007199254740993, rejection of unsafe numeric and malformed/out-of-range input, adjacent/stale conflicts, successful role change with an exact string, safe-number compatibility and revocation at the PostgreSQL bigint maximum. Test fixtures update only isolated membership rows; the sequence is not modified. Browser interaction and broader staff-management acceptance remain open.
