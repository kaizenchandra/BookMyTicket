# Reading long customer support conversations

Open /cases, choose View conversation, then use Older messages and Newer messages to move through pages of up to 50 customer-visible messages. Latest messages returns to the newest page; Refresh messages updates the current page. Within each page, messages run oldest-to-newest with timestamps.

An unsent reply remains while paging within the mounted conversation. A successful send returns to the latest messages and refreshes case status. Closing the page or remounting the conversation does not preserve a draft or retry key. Internal staff notes are never included.

API clients retain items but must follow nextCursor with after for complete histories. The default now returns the newest 50 messages rather than every message. Keep the same account and case. A bad/differently scoped cursor returns INVALID_CURSOR; restart without after. Inaccessible cases return 404. New replies do not alter an older page boundary.

Apply migration 039 through the normal migration-gated startup. Existing full native/container and smoke commands apply. Tests are in tests/support-operations.test.ts; direct adapter assertions in tests/inventory.test.ts use the new page envelope. Staff-thread pagination and browser acceptance remain outstanding.
