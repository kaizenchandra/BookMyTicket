# ADR 031 — Support queue pagination

Support agents must reach matching cases older than the first 100 (FE:SUP-A-01, BE:API-05). Keep the existing 100-item page size and items envelope; add nullable nextCursor and optional after query input. Use descending creation time and UUID with exact PostgreSQL microseconds. Migration 036 adds global and assignee pagination indexes.

Cursors include the boundary and a hash of agent identity and normalized filters. They are validation context, not credentials or signatures; support permission and fresh MFA are checked on every request. Malformed or differently scoped cursors return 422. Queries remain parameterized and never expose conversation text or customer identity through queue summaries.

The workspace supports Next, Previous and First page. Filter changes and explicit Refresh return to the first page; session changes clear private state. Pending responses are ignored after effect cleanup. Conversation drafts remain mounted when paging.

Pages are live reads, not a frozen export. Newer arrivals appear after returning to the first page. Changing case state or assignment may move a record into or out of filters between requests. Stable creation-time ordering prevents updates from moving an existing row across the traversal boundary. Browser history persistence and full browser/accessibility acceptance remain outstanding.
