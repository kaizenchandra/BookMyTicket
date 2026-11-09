# Support-case assignment

At /operations, select a case and expand Supervisor assignment. Search by agent contact or exact account UUID, select the intended active agent, enter a reason, and confirm replacement. See [agent search](support-agent-directory.md) for pagination and disclosure limits. The current assignee is shown explicitly.

The operator needs platform support and support_assign permissions and fresh MFA. The recipient needs an active account and platform support permission. A provider role alone is insufficient. This feature never creates those grants; use the organization's approved staff-access process.

On a version conflict, refresh the selected conversation and review its current owner before trying again. Identical retries after a lost response return the original committed result; the UI refreshes current state afterward. Changing the input generates a new command key. Revoked permission or inactive target rejects the request even on retry.

Resolved cases cannot be assigned until reopened. Escalation is preserved. Assignment does not send customer messages, change bookings or execute refunds. Audit action support.case.assigned records the reason, previous/new owner, versions and success outcome.

Migration 031 is additive and retains retry results. Never clear the command table to retry an uncertain operation. Local PostgreSQL/HTTP and Docker evidence is under docs/evidence/support-assignment-*. Browser acceptance remains unverified.

Successful supervisor assignments now queue a generic recipient inbox notice. It reflects the recorded assignment, not guaranteed current ownership. [Notification behavior and recovery](assignment-notifications.md).
