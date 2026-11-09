# Staff member pages

Open Manage staff and invitations in /partner as an organization owner with fresh authenticator verification. Use First member page, Previous member page and Next member page to browse groups of 20 members. Invitation navigation is independent. Role changes and revocation are available on every page with existing confirmation and version checks.

GET /api/v1/organizations/:id/staff now returns members (maximum 20), nextMemberCursor, invitations and nextCursor. Send nextMemberCursor.afterMemberId as afterMemberId to continue members. Preserve invitation afterCreatedAt/afterId when you want to keep that invitation page. Stop each list independently when its cursor is null. Member versions remain exact strings.

Compatibility: API clients previously receiving the complete member list must paginate. The existing membership primary key supports the query, so no migration, seed or grants are needed. Pages are live; revoked members disappear and new members can sort before the current page. Navigate back from an empty later page or return to the first page.

Evidence prefix: docs/evidence/member-pages-. Browser navigation/accessibility and load acceptance remain unverified. See ADR 071.
