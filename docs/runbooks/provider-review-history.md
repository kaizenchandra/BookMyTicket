# Provider review decision history

Owners open Review decision history on an organization in /partner. Authorized moderators follow View decision history from the review queue or use /admin/provider-history with an organization reference to inspect an application that has left the queue. Owner history omits reviewer identifiers; moderator history includes reviewer UUID references.

Pages show at most 20 decisions with the reviewed and resulting application versions, time and reason. Older decisions uses beforeVersion; Latest decisions restarts paging. Historical results do not replace current state. Earlier reviews are not synthesized: legacy latest feedback can exist even when history is empty.

Review requests remain POST /api/v1/admin/providers/:id/review. Exact retries by the same currently authorized reviewer return the recorded result without another transition/history row. Different reviewer/decision/reason for an already decided input version returns REVIEW_CONFLICT. Refresh the application before making a new decision; never increment a version speculatively. Reject is available alongside approve/request changes once private details have loaded.

Migration 049 creates immutable decision records. Do not rewrite history to correct a reviewer mistake; a separate authorized remediation workflow and approved retention policy remain outstanding. A failed history insert rolls back the decision. History access is audited without reason text; audit failure withholds results.

Evidence: docs/evidence/provider-review-history-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Automated verification covers replay, 22-row traversal, access privacy, permission revocation, immutability and rollback. Browser/reviewer/rejection/accessibility acceptance, complete application snapshots and under-review workflow remain open.
