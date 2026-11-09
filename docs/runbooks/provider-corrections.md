# Provider draft corrections

Open /partner and find the organization. Latest review feedback shows the recorded reason. Owners can change the name while state is draft or changes_requested, save it, then Submit/Resubmit for review. Saving is separate from submission. Organization kind and other onboarding fields are not editable in this form. Editors/viewers cannot edit or submit; submitted/approved/rejected/suspended organizations are read-only here.

Unsaved name edits stay visible across refreshes and block submission. On a conflict, copy any useful draft text, then explicitly Discard draft and reload organization before reapplying changes. Page navigation warns about unsaved edits. No durable browser draft storage is provided.

PUT /api/v1/organizations/:id/draft requires name and expectedVersion. POST submit retains its version input. Identical immediate retries are safe; changed/older requests conflict. Unauthorized submit now returns 403 FORBIDDEN rather than the former generic conflict. Owner permissions are rechecked in the transaction using the staff-management lock order. Latest feedback is retained after resubmission.

No migration/configuration is needed. Existing provider audit triggers record state/version changes. Evidence: docs/evidence/provider-drafts-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser/multi-organization/accessibility acceptance and full contact/document/business/payout onboarding remain open.
