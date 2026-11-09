# ADR 069: Recipient invitation pagination

FE:PRV-09, BE:PRV-08 and BE:API-05 require reachable invitation workflows and stable pagination. GET /api/v1/provider-invitations previously returned only 100 invitations. It now returns items (maximum 20) and nextCursor, using the same validated six-digit UTC timestamp/UUID boundaries as owner history.

The authenticated principal's contact remains the sole recipient selector. Every query filters pending state and authoritative database-time expiry, then orders by created_at/id descending with a strict tuple boundary. Timestamp strings are emitted by PostgreSQL to preserve microseconds. Migration 062 adds a contact/creation/ID partial index for pending invitations. Cursors are boundaries, never authorization, and cannot expose another contact's records.

The recipient application use case requires authentication but retains the existing policy of not requiring owner MFA. Acceptance still revalidates contact, state and expiry inside its existing transaction. Pagination neither grants membership nor extends invitation expiry. Pages are live; accepted, revoked or expired records disappear, and new invitations appear on the first page.

The partner invitation inbox now uses First, Previous and Next controls with exact cursor history. Session or organization changes reset navigation. Acceptance refreshes the current page; an empty later page can be navigated back. Owner history and membership controls retain existing behavior. OpenAPI documents the paged response and both required-together optional boundaries.

Tests traverse 103 valid invitations, check ordering and precision, exclude other contacts and unavailable states, accept an older invitation and verify its removal, reject malformed queries, enforce authentication and preserve recipient access without owner MFA. Browser/navigation/accessibility, member pagination, delivery/resend and load acceptance remain open.
