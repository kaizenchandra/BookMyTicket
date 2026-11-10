# Hotels & property management

Open `/admin/hotels`. An access administrator must assign `hotels.read`, plus `hotels.manage` for onboarding/edit/submit and `hotels.review` for decisions, suspension/delisting/reopening. Fresh MFA is required. No grants are automatically seeded.

Create a stable property code and save a draft hotel or homestay. Fill property description, city/address/coordinates, private email/phone, associated supplier name/reference, HTTPS image URLs and alt text, amenities/facilities, house rules, check-in/out and cancellation policy. Supplier references are administrative metadata, not verified integration accounts. Image references are stored; file uploading and supplier media download are not provided. Private contacts and supplier association are never published.

The directory and detail show missing publication fields. Supply a reason to submit for review. Reviewers approve or reject with a reason. Rejection returns the record to draft. Published properties appear at `/hotels` and `/api/v1/hotels`; they do not offer availability or booking. Saving edits to a published property withdraws it until reapproved. Suspension/delisting removes it immediately; reopen returns it to draft. The UI requires confirmation for edits and state changes.

Each save/decision requires the current version. On stale-version conflict, reload and review the latest state before resubmitting. Revision history preserves content, policies, actor, timestamp, action and reason. Older history is paginated. Audit and history failures roll back changes. Do not attempt to rewrite immutable revisions.

Filter by name/code, city, type and status. A bounding-box filter requires south/north/west/east together, with increasing values; ranges crossing the antimeridian are not supported. Start over when changing filters because page cursors are scoped to the filters and actor.

Migration 077 adds hotels-owned state/history and expands assignable admin permissions. Existing cinema/event/sports inventory and booking remain unchanged. External supplier content sync requires the authorized provider name, official API specification and secure sandbox credential location; do not paste credentials into profile fields or chat. FR-BE-038 remains blocked. Tests: `tests/hotel-administration.test.ts`; evidence: `docs/evidence/hotel-management-*`.
