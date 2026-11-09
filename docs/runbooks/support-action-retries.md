# Support action retry recovery

At /operations, select a case and use Claim, Release, Escalate, Resolve, Reopen or Set priority with a reason. If a request fails or its response is lost, retry the unchanged action while the view remains open. The original result is recovered when it committed; the workspace then refreshes current case state. An old result is not evidence that the case still has that state.

Changing the case, action, version, priority or reason represents a new command. A stale version or another agent's ownership still conflicts for a new command. Current support permission and fresh MFA remain required for retries. If the page was closed or the view remounted, inspect current state before submitting again because the browser key was not retained.

API clients should send an 8–100 character Idempotency-Key to POST /api/v1/operations/cases/:id/actions and reuse it only with identical normalized input and the same actor. Changed input returns IDEMPOTENCY_CONFLICT; original-result recovery adds replayed: true. Headerless legacy calls retain prior behavior without this recovery guarantee.

Migration 037 is additive and applied through normal migration-gated startup. Do not clear action_commands to recover an uncertain action. The tests/support-operations.test.ts suite verifies this behavior using isolated PostgreSQL and real HTTP injection. Approved command retention and browser acceptance remain outstanding.
