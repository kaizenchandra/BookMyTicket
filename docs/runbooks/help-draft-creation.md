# Creating FAQ drafts

Open /admin/help with current staff MFA and platform moderation permission. Choose Create help article, enter a unique lowercase ID using letters, numbers and single hyphens, then enter the question, answer, topic, internal destination and reason. Review Draft preview and select Create unpublished draft.

Choose the created article from the refreshed list to review and publish it through the existing editor. Creating a draft does not make it visible in public Help. Article IDs and destinations cannot be changed afterward with this workflow.

If a request fails, Retry original creation repeats the same ID and fields. An identical retry by the original authorized actor returns the creation receipt without resetting later edits or publication state. A changed payload or another actor using the ID receives a conflict. Discard draft and load articles clears the local form; changing to a new ID creates a separate article, so inspect existing articles before doing that after an uncertain result.

POST /api/v1/admin/help accepts id, question, answer, topic, destination and reason. Supported destination keys are bookings, discovery, account and support. Arbitrary URLs and a published field are rejected. Migration 069 adds immutable catalog.help_creations receipts. Audit actions are help.created and help.creation.replayed. No application grants are installed.

Evidence prefix: docs/evidence/help-creation-. Creation-history display, deletion, destination editing, approval, retention, browser/accessibility and load acceptance remain open.
