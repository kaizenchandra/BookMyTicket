# Private provider onboarding

In /partner, owners open Private business and contact information for their organization. Supply the business name/address, contact person and email; international phone is optional. Incomplete drafts can be saved. Complete the four required fields, save both organization and private edits, then submit separately. Submitted/approved states are read-only. Requested corrections can be edited and resubmitted through the existing workflow.

Contact details are supplied for onboarding, not verified login identities or public venue contacts. Do not enter payout credentials or supporting-document contents in these fields. Document upload and payout verification are not implemented here.

Moderators open a provider application's private view from /admin before using its approval/change-request controls. The returned version is used for the decision. Existing submitted applications with missing required details cannot be approved; request changes so the owner can complete them. Existing approved organizations are unaffected.

Owner endpoints: GET/PUT /api/v1/organizations/:id/onboarding. Reviewer endpoint: GET /api/v1/admin/providers/:id/onboarding. PUT takes the complete private draft plus expectedVersion. On conflict, copy needed unsaved changes and explicitly reload; do not invent a new version. Read/save audits omit field values, and audit failures abort the operation. Ordinary organization lists never include private onboarding data.

Migration 048 creates the private table without filling in assumed details. No new secret or outbound channel is needed. Evidence: docs/evidence/provider-onboarding-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser/accessibility acceptance, production data-retention/security review, documents, payout verification and full onboarding acceptance remain open.
