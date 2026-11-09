# ADR 024 — Searchable audit history

Implemented scope: FE:ADM-UI-15; partial BE:DAT-11/12/13. No full reporting or audit completeness claim.

The existing immutable Reporting audit table is the source of this read-only workspace. /admin/audit calls GET /api/v1/admin/audit with optional exact actor UUID, action and target filters and an inclusive-from/exclusive-until timestamp range. HTTP authenticates and checks the platform audit grant and fresh MFA on every page; providers cannot use organization membership as authorization. Reporting's application port isolates query persistence.

Pages contain at most 50 records, newest audit ID first. The opaque cursor binds the requesting account and normalized filters, the initial maximum visible ID and the last returned ID. Invalid or mismatched cursors return 422. Large bigint IDs remain strings, avoiding JavaScript rounding. Inserts with later IDs cannot push older pages around. This is keyset browsing, not a retained database snapshot: a transaction with an earlier allocated ID that commits later may appear or be missed as traversal progresses. Refresh the first page for current records; no point-in-time export claim is made.

Migration 029 adds actor/action/target/time indexes and does not rewrite historical records. Existing immutable-row triggers remain intact. The API no longer exposes arbitrary details JSON; the only derived field is a recognized explicitly recorded outcome (success, failure or denied). Missing or unrecognized outcomes display Not recorded. Null actors remain null; the UI does not invent a user or infer success.

The frontend ignores superseded responses, clears records on session events and is keyed by account. Filters are not persisted in public URLs or browser storage. Loading, empty, forbidden/MFA, validation and network errors retain form input and offer retry. It uses existing Light/Dark components and semantic form/heading/list elements. Browser, keyboard, screen-reader and five-width acceptance remain unverified because the browser host is unavailable.

Verification: tests/audit-history.test.ts exercises the real HTTP application and PostgreSQL: permission/MFA denial, revoked grants between pages, 55-record keyset traversal with a new insert, filter/account cursor scope, strict malformed input, literal exact matching, timestamp boundaries, JSON response contract, metadata redaction and immutable-row guards. See audit-history-full-suite.txt and audit-history-container-tests.txt.

Outstanding: consistent tenant/correlation/reason/outcome capture across every writer, audited read-access policy, dedicated archival/retention policy, additional field-level views and asynchronous exports. These are not silently backfilled or treated as complete by this viewer.
