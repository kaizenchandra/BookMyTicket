# Owner invitation history pages

In /partner, open Manage staff and invitations for an organization you own. Fresh authenticator verification remains required. The panel shows 20 newest invitations at a time. Use Next page for older records, Previous page to retrace pages, and First page to see new invitations. Existing revoke and member-role controls retain their authorization and version checks. Creating an invitation returns to the first page.

GET /api/v1/organizations/:id/staff now returns members, invitations (maximum 20) and nextCursor. Follow both nextCursor.afterCreatedAt and nextCursor.afterId as query parameters; stop at null. Preserve the exact timestamp string, including all six fractional digits, and URL-encode query values. The boundary is scoped by the route organization and requires current owner authorization on every request.

Compatibility: clients expecting up to 100 invitations in a single response must paginate. Membership listing is unchanged. Expired status is computed at read time; pages are not snapshots, and new invitations appear on the first page. The recipient inbox still has its existing 100-item limit; this change covers owner history.

Apply migration 061 through the existing migration service. No seed or new grants are needed. Evidence prefix: docs/evidence/invitation-pages-. Browser navigation/accessibility, load acceptance, recipient inbox and member pagination remain open. See ADR 068.
