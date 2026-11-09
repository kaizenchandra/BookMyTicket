# Help revision history

Open /admin/help with current staff MFA and platform moderation permission, choose an article, then select Load article history. Loading history preserves your unsaved draft. Expand Content before this edit to inspect the prior question, answer, topic and publication state. Each edit includes its input/output versions, staff reference, reason and recorded time in India time.

History is not the current answer and does not provide a restore action. No recorded edits means the article has no retained save receipts. Newest edits reloads the newest page; Older edits uses a stable version boundary. Failed loads expose Retry history. Changing articles or accounts resets the panel.

GET /api/v1/admin/help/:id/history accepts optional beforeVersion as a positive integer string, returns at most twenty items, and provides nextCursor when older records exist. Reuse that cursor as beforeVersion. Unauthenticated/unauthorized callers cannot access unpublished content or staff references. Read auditing uses help.history.read; audit failure withholds results.

No migration is required. Evidence prefix: docs/evidence/help-history-. Browser/editor/accessibility, load, retention and restore acceptance remain open.
