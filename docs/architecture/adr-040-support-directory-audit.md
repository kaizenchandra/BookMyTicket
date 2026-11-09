# ADR 040 — Staff directory access auditing

The supervisor directory exposes verified contacts for active support accounts. Complete its previously documented access-audit gap by injecting Reporting's public SecurityAudit port into Identity's PostgreSQL directory adapter. Identity already depends on that public contract for session auditing; no new module dependency or private table access is introduced.

Every successful search page, including empty results, records identity.support_directory.read in the same local transaction as permission checks and the directory read. Actor and target identify the supervisor. Details contain at most 25 returned account UUIDs, count, olderPage, hasMore and outcome=success. No search text, contact, cursor, or reversible search digest is stored. Returned identifiers support controlled investigation without copying the disclosed contact information.

If audit persistence fails, the transaction rejects and no directory result is returned. A later successful retry records another access: reads intentionally do not use command deduplication. Validation/permission denial does not create a success record; comprehensive denied-access/security-event logging remains separate scope. Existing active-account, supervisor grant and MFA checks remain in force.

The existing /admin/audit search can locate these records by action and actor. It deliberately exposes metadata only, not raw details/returned account identifiers. Authorized database audit investigation and eventual controlled export remain subject to the existing operational access policy; this change adds no export or permission grants. Existing immutable-audit protections apply; approved retention remains outstanding.

Database/HTTP tests cover multi-page and empty results, exact bounded audit fields, query/contact exclusion, denied/malformed requests, current permission revocation, and metadata-only audit search. A test-only injected fault after a real audit insert verifies transaction rollback and absence of a returned result. No external service is simulated as successful. Browser and broader audit acceptance remain open.
