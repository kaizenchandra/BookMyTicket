# ADR 032 — Restricted support agent directory

FE:SUP-A-07 and BE:SUP-02 require practical controlled assignment. Supervisors previously needed an account UUID from outside the application. Add an Identity-owned search use case and adapter at GET /api/v1/operations/support-agents. Support continues to own case assignment; no cross-module private table access is introduced.

Require active authentication, platform support and support_assign grants, and fresh MFA on every page. Recheck both grants inside the directory read transaction. Search accepts 3–254 trimmed characters, matches contact substrings literally (SQL wildcards escaped) or an exact account UUID, and returns only active accounts with platform support permission. Results disclose only account UUID and verified account contact to supervisors. No profile, session, MFA, customer or other-role data is returned. No new grants are provisioned.

Return at most 25 results ordered by UUID, with an actor/query-scoped cursor and nullable nextCursor. Cursors validate navigation context and are not authority. Results are current read snapshots; changed eligibility may change later pages. Search is explicit, not triggered on every keystroke. The form provides selection, First results and More agents controls; a selected agent is visibly identified before the reason and replacement confirmation.

The existing assignment transaction independently locks and checks operator and target permissions. Directory selection never reserves eligibility; revoked/suspended targets cannot be assigned using stale results. Existing assignment retry, reason, audit and case-version safeguards remain intact.

No new dependency or migration is required. Broad contact searches are supervisor-only and bounded in returned rows; large-directory indexing/load acceptance and dedicated directory-read auditing remain open. This does not implement general identity administration or staff provisioning. Browser, keyboard, screen-reader and responsive acceptance remain unverified.
