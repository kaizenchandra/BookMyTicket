# ADR 073: Membership action recovery

FE:PRV-09 and BE:API-03/12 require reliable staff management and retained business uniqueness. Migration 064 adds immutable membership commands keyed by organization, target account and exact bigint input version, binding the original actor and editor/viewer/revoke action. The response can be reconstructed from the target/action; no contact payload is retained.

The adapter first locks the organization and checks current owner membership, then looks for a command. Same-actor/same-action replay returns the original accountId/role result without changing membership or repeating audit. Changed actors/actions conflict. Current fresh MFA is enforced by the application even for replay.

For new commands, target membership/version and owner-protection checks remain mandatory. Role update or deletion, command record and audit event commit together. Audit failure rolls everything back. Historical commands remain independent of the current membership row, so replay after deletion or a newly accepted replacement never recreates, deletes or downgrades current access. Exact global membership versions distinguish replacement memberships.

The frontend captures the original command, retains it after failure and offers Retry original membership action or Dismiss membership recovery. Other member action buttons disable while recovery is pending. Successful recovery refreshes current lists; its historical action is not applied locally as current state. Session/organization changes clear attempts and stale responses are suppressed. Attempts are memory-only.

Tests cover six concurrent identical commands, one command/audit event, actor/action conflicts, rollback of role changes and deletion, replay after later roles and replacement membership, immutability, MFA loss and ownership downgrade. Legacy commands are not reconstructed. Retention, reload persistence and browser/recovery/accessibility acceptance remain open.
