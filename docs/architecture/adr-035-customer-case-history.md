# ADR 035 — Paginated customer support history

FE:SUP-C-04 and BE:API-05 require accessible conversation history with stable pagination. GET /api/v1/cases retains its items envelope and default 100-row bound, adds nullable nextCursor and accepts after. Exact caseId access remains available but cannot be combined with a history cursor.

Support owns the query. Every request authenticates the current account and constrains rows to that owner. Cursor boundaries use exact PostgreSQL microsecond creation time plus UUID in descending order. An owner/selection hash validates navigation context; cursors confer no authority and are not signatures. Malformed or differently scoped cursors return 422. Migration 038 adds an owner/creation-time/UUID index.

The history page shows case summaries and links to individual conversations, avoiding one message request per listed case. Conversation replies and escalation remain on the exact-case page. Older cases and Newest cases are ordinary links with cursor state in the URL; the browser can revisit page URLs. In-app history/conversation navigation warns before discarding an unsent creation draft. Full scroll restoration, draft persistence and browser acceptance are not established.

These are live pages, not snapshot exports. New arrivals appear on the newest page; updates to case state do not move creation-time boundaries. Deletions, if introduced by a later retention policy, may change page contents. Exact case links still check ownership and reveal no internal notes. No case mutation or notification is caused by reading history.

Tests exercise 206 cases including timestamp ties, new arrivals, state changes, exact selection, foreign cursors, invalid query combinations, malformed cursors and account suspension. Browser keyboard/viewport/accessibility acceptance and conversation-message pagination remain outstanding.
