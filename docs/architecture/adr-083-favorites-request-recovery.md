# ADR 083: Favorites request scope and retrieval contracts

This increment advances FE:AUTH-12, FE:ENG-01, FE:ENG-02, BE:CUS-04 and BE:API-05. It does not add artist/team favorites or complete browser acceptance.

The Favorites list and shared SaveListing control invalidate asynchronous completions when their account/resource/view scope changes. A generation counter also distinguishes returning to a prior scope from continuing the original request. Cleanup invalidates completions after unmount. Success, failure and busy-state completion are all guarded. Status and page data are rendered only for the scope that loaded them. A pending sign-in Save action is bound to its collection and listing ID; navigating to another resource cannot save that resource implicitly.

List loads clear the previous cursor, distinguish load failures from an empty collection, hide next-page links until a successful load and expose an explicit retry. Existing server-side owner checks remain authoritative: ignoring a response does not cancel an already accepted mutation.

Named strict API schemas now describe the favorites query, bounded twenty-four-item page, nullable unpublished summary and save/remove/status response. The application uses the shared query schema and generated OpenAPI includes response and query contracts. No storage schema or module ownership changes are needed.

HTTP tests validate actual pages, unpublished redaction, empty results, all three state operations, authentication and malformed/extra/repeated query parameters. A delayed-promise test validates request invalidation including account return visits, resource changes and cleanup. These tests do not substitute for React/browser event-order, sign-in navigation or accessibility acceptance, which remains open.
