# Listing review retry recovery

On /admin/listings, submit the decision and reason. If the request fails or the response is lost, Retry original decision resends the captured listing version, decision and reason. It does not use subsequent form edits. A retry from the same authorized reviewer returns the original committed result without repeating the transition. Successful saves/replays refresh the current queue.

A different decision, reason or reviewer for the same already-reviewed version returns CONFLICT. Refresh to inspect current state; do not interpret a historical replay response as proof that the listing is still published. Current moderation permission and MFA remain required. Decisions recorded before migration 052 cannot be recovered through this new durable replay mechanism.

Migration 052 creates immutable catalog.review_decisions. Do not edit/delete decision rows to resolve a conflict. New listing lifecycle actions must use a new current version. A retention/remediation process and historical decision UI remain future work.

The local demo seeding script now requires DEMO_REVIEWER_ID for new submitted listings, referencing an existing active account with platform moderation permission. It creates no permission grants. Existing published demo listings do not require a new review. Do not rerun seeding as part of normal deployment.

Evidence prefix: docs/evidence/listing-review-retries-. Backend transaction and retry tests are verified separately from browser, navigation and accessibility acceptance, which remain open.
