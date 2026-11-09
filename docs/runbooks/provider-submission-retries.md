# Provider submission recovery

Save the organization name and required private onboarding details in /partner before Submit for review or Resubmit for review. On an uncertain response, use Retry original provider submission. It uses the captured organization/version and never submits current unsaved edits. Dismiss submission recovery allows a deliberate new submission after checking current status.

Successful recovery refreshes current review state. The original successful result may precede corrections or approval; do not interpret it as the current status. Recovery is lost when the component unmounts, on reload or session change.

API callers continue POST /api/v1/organizations/:id/submit with {"version": <expected version>}. An identical original-actor retry returns the original result. A different current owner receives 409; revoked ownership receives 403. New submissions retain complete-onboarding and editable-state checks. The operation is identified by organization/input version, with immutable actor attribution rather than a new header.

Migration 058 must run before serving this release. Old submissions have no durable result and are not backfilled: refresh the organization after an old version conflicts. Do not delete submission mappings to retry or reverse review decisions. No seed or new application grants are required.

Evidence prefix: docs/evidence/provider-submission-retries-. Tests and HTTP smoke checks do not establish browser retry/accessibility acceptance. See ADR 065 for atomicity and remaining limitations.
