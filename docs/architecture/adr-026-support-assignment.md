# ADR 026 — Controlled support reassignment

Implemented subset: BE:SUP-02/06/08 and FE:SUP-A-07/08. The existing agent claim/release/escalate workflow remains available.

A separate POST /operations/cases/:id/assignment use case requires active platform support and support_assign grants plus recent session MFA. Assignment does not grant permissions. The target must already be an active platform support account. No accounts or grants are provisioned by this feature.

The command accepts case version, target UUID and reason, plus an actor-scoped idempotency key. In one transaction it serializes the actor's retry commands, locks the case, locks actor/target accounts and grants through Identity's public StaffAuthorization contract in deterministic account order, checks prior command fingerprint and case version, updates assignment and persists audit plus original outcome. Permission revocations block subsequent retries. Competing supervisors on the same version have one winner. Original outcomes may be returned after later case changes; the UI reloads current case state.

Open and in-progress cases become in_progress; escalated cases remain escalated. Resolved cases must first be reopened through the existing permitted workflow. Assignment never changes financial, inventory or ticket state. The former assignee fails the existing reply ownership check immediately after reassignment commits.

The UI in /operations requires the target's account UUID and explicit replacement confirmation, explains the separate role, retains failed input and reuses its command key for identical retries while mounted. Reasons and before/after assignee IDs are recorded in the immutable audit. No customer reply is sent by assignment.

Migration 031 stores durable command results. No expiry is currently applied; retention needs approved policy. Additive migration supports application rollback without deleting records. Browser availability prevented interactive/accessibility acceptance. Target directory search, queue pagination, notifications, bulk assignment and full operational timelines remain outstanding.
