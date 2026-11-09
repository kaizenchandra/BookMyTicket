# ADR 036 — Bounded customer conversation pages

The customer GET /api/v1/cases/:id/messages endpoint previously loaded the entire visible conversation. Return at most 50 messages plus nullable nextCursor; an optional after cursor fetches older messages. Each page is displayed oldest-to-newest, but traversal starts with the newest page. API clients must now follow nextCursor to retrieve complete histories. The items envelope and message fields remain unchanged; this bounded default is an explicit behavior change.

Support checks case ownership before querying messages. The customer audience predicate applies before ordering and LIMIT, so internal notes neither appear nor influence the visible page boundary/count. Exact PostgreSQL microseconds plus descending UUID prevent gaps from tied timestamps. Cursors carry an account/case/audience-scope digest for context validation, not authority. Current authentication is checked for every HTTP request. A foreign case returns 404; another owned case with a reused cursor returns 422.

Migration 039 adds a case/time/UUID partial index for customer-visible messages. Replies and workflow transitions retain existing transaction and retry behavior. Reading pages never changes case state. New messages are visible on Latest/Refresh; older page boundaries are live reads and do not advance when a new reply arrives.

The customer conversation includes Older, Newer, Latest and Refresh controls, loading/error/empty states and message timestamps. Paging uses component state so an unsent reply stays mounted. Successful sends return to the latest page. Page closure, parent remount and case changes do not persist drafts/keys; this is not durable draft recovery. Staff operations detail still loads the complete thread and remains a separate outstanding pagination task.

PostgreSQL/HTTP tests cover 106 visible messages with tied microseconds, 60 newer hidden notes, new arrivals, chronological page ordering, cursor validation, cross-case/owner isolation and account suspension. Browser, accessibility and visual acceptance remain unverified.
