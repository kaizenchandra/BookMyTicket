# Reading long staff support conversations

In /operations, select a case. The conversation shows up to 50 messages with explicit Internal note or Customer-visible message labels. Use Older, Newer, Latest and Refresh messages to navigate. Each page displays messages in chronological order.

Reading pages does not advance the case version held by unsent edits or reset the reply/assignment form. If an action reports a version conflict, use the main case refresh, review current state and retry as appropriate. Message-page refresh alone does not resolve an editing conflict. Successful case changes reload the latest thread. Drafts are not persisted through view closure or remount.

The staff detail API now bounds messages to 50 and returns nextMessageCursor. Pass it using after until null for complete history. Every page requires current support permission and recent MFA. A changed account/case requires starting again. Read audit records contain counts/page type, without message text.

Apply migration 040 through normal migration-gated startup. Existing native/container suites and smoke commands apply; tests/support-operations.test.ts covers pagination, privacy, audit and stale-edit behavior. Browser/keyboard/visual/accessibility acceptance remains open.
