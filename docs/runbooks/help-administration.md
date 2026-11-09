# Help content administration

Open /admin/help using an account with platform moderate permission and a current staff MFA session. No grants are created by this feature. Use [search and pagination](help-administration-list.md) to find an existing answer, edit its question/answer/topic, review the text preview, select whether it is published, and enter a reason. Save content and publication state applies immediately; there is no separate draft/approval workflow.

Unpublishing removes the answer from public search. Fixed action links cannot be changed here. [Create unpublished drafts](help-draft-creation.md) from the article list. Deleting articles is not available yet. Authorized staff can inspect [prior revisions](help-revision-history.md) without discarding their draft.

If a save fails, Retry original save repeats its retained fields/version/reason. A successful retry may refer to an earlier version; the workspace reloads current content afterward. A conflicting edit requires Discard draft and load latest articles; copy wanted text before discarding. Replaying an earlier publish does not undo a later unpublish.

Migration 068 installs the initial six articles and immutable save receipts. The runtime source is catalog.help_articles, not the old TypeScript bootstrap fixture. Do not rerun seed SQL or delete history to resolve conflicts. Restore or corrections must preserve receipts and audit history; approved retention remains outstanding.

Evidence prefix: docs/evidence/help-admin-. Audit actions are help.read, help.saved and help.save.replayed. No external delivery or payment calls are involved. Browser interaction, accessibility, load and operational recovery acceptance remain pending.
