# ADR 011 — Serialized support case operations

Status: implemented locally; browser acceptance pending.

Support owns case lifecycle and messages. Reporting owns audit records through its public SecurityAudit port. Identity authentication, a current platform `support` grant and MFA verified within the existing 30-minute window protect every staff endpoint. This does not grant inventory or financial override privileges.

The application service authenticates and authorizes before invoking the persistence port. Domain transitions are framework-independent. Case actions take a row lock and compare an expected version, then update and audit in one transaction. Concurrent claims have one winner. Reusing a stale version returns conflict without duplicating the mutation; clients refresh to inspect the outcome. Durable idempotency response lookup remains future work.

Development workflow policy:
- An unassigned case can be claimed. Claim moves open to in_progress and preserves escalated status.
- Only the assigned agent can reply, change priority, release, escalate or resolve.
- Release clears ownership. Escalation clears ownership and preserves a distinct escalated queue; no supervisor notification or SLA promise is implied.
- Resolved cases reject staff writes until reopened. Reopen clears ownership. A customer reply also reopens a resolved case, increments its version and records an audit entry.
- Every staff action requires a reason; replies explicitly select internal or customer audience. Customer APIs never return internal notes. Sending a reply persists it in the case, not in an external email inbox.

Reads and staff actions are audited without copying message bodies to the audit log. Customer access remains owner-scoped. Queries support status, priority, category and assignment filters and return the latest 100 matches, explicitly stated in the UI. Customer replies and agent actions share the same case lock so resolution cannot silently overwrite a newly committed reply under an older version.

Migration 016 adds priority, version, updated_at, lifecycle constraint and queue index without deleting existing records. Deployment uses the existing advisory-locked migration runner. Recovery: restore application availability using a compatible artifact; do not drop populated columns to roll back. An unexpected legacy state requires investigation before applying the lifecycle constraint.

Tests: real Fastify/PostgreSQL workflow, MFA/grant gates, cross-customer denial, private notes, duplicate reply rejection, concurrent claims, stale action rejection, escalation filtering, customer reopening and audit. Browser host unavailable; interactive UX, accessibility and production service objectives are unverified.

Remaining scope: supervisor reassignment/abandoned ownership recovery, configurable SLA routing, attachments, related booking/payment context, outbound notifications, financial actions, pagination and complete idempotency result retrieval. This ADR does not claim full BE:SUP or FE:SUP-A completion.
