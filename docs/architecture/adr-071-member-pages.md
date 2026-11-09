# ADR 071: Independent staff member pagination

FE:PRV-09 and BE:API-05 require usable staff management and stable pagination. GET /api/v1/organizations/:id/staff previously returned every member while paging invitations. It now returns at most 20 members with nextMemberCursor independently of the existing invitation page and nextCursor.

The optional afterMemberId UUID is a strict ascending account-ID boundary. The query fetches 21 rows, returns 20 and emits the last returned account ID when another page exists. The existing primary key on organization_id/account_id supports this query; no migration is needed. Membership versions remain exact decimal strings.

The application retains fresh MFA and the adapter retains organization locking and current owner authorization before either query. Member cursors are coordinates, not grants. Role changes and revocation continue to use existing transactional version/permission checks, including on later pages. Removing a boundary member does not invalidate a cursor because ordering uses its immutable account ID rather than an offset.

The staff workspace adds separate First/Previous/Next member controls and an empty-page message. Member navigation preserves invitation position and vice versa. Session and organization changes reset both histories. Queries are live views: new members may appear earlier than the current boundary and removed members disappear. First page refreshes the beginning of the current list. Recipient inbox requests continue rejecting member-only query parameters.

OpenAPI describes the independent optional boundary and nextMemberCursor. Clients expecting all members in one response must paginate. Tests traverse 46 members in 20/20/6 pages, check exact ordering, combine both cursors, perform role/revocation actions on the final page, and reject malformed boundaries, outsiders, lost MFA and downgraded ownership. Browser/navigation/accessibility and load acceptance remain open.
