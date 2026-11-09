# Customer support history

Open /cases for the newest 100 case summaries. Choose Older cases to continue, Newest cases to restart, or View conversation to read and reply to one case. The individual case page also provides escalation where eligible. Page URLs carry the cursor, so browser navigation can revisit them; drafts are not durably stored.

If a new-case draft is unsent, the history and conversation links ask before discarding it. Finish or copy your draft before leaving the page. New arrivals are visible on the newest page. Case status is read live and may change between requests.

API clients follow nextCursor using after until null. Keep the authenticated owner unchanged; never combine after with caseId. On INVALID_CURSOR, remove after and restart. Exact caseId requests remain owner-scoped and return an empty result for unavailable/foreign cases. The additive nextCursor field preserves items for older clients.

Migration 038 adds an index through the existing migration-gated deployment. Run tests/support-operations.test.ts with the documented isolated database URL, plus the existing full native/container suites. No new configuration or fixtures are needed in the application database. Browser/accessibility verification and per-conversation message pagination remain open.
