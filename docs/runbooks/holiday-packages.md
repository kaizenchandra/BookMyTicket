# Holiday package management

Open `/admin/packages` with packages.read and fresh MFA. Editing/planning/submit requires packages.manage; review decisions/unpublish require packages.review. No account grants are seeded automatically.

Create a stable package code and definition. Add destinations, consecutive itinerary days beginning at 1, inclusions/exclusions, HTTPS image references with alt text, travel dates, party/child limits, policies, supplier component references/costs, optional add-ons, markup and fee. Travel dates are inclusive: a two-day itinerary ends one day after its start. Component/add-on keys and departure starts must be unique. Supplier references are metadata, not credentials or confirmations. Media files are not uploaded or fetched by the server.

Save drafts while incomplete. Missing publication fields appear in the directory/detail. Preview the customer-facing content in the detail screen. Submit complete content with a current/future departure for approval; reviewers approve or reject with reasons. Published information appears at `/holidays`, excludes private supplier/commercial data and offers no booking. Editing a published package returns it to draft; unpublish also returns it to draft. Reload and review current data after stale-version errors.

Price preview accepts a configured non-past departure, adult count, child ages and selected add-ons. It applies stored component costs, half-up markup, fixed fee and add-on basis. All monetary inputs are integer INR paise, markup uses basis points (100 = 1%). Preview does not calculate additional taxes or obtain supplier prices. Child age/occupancy and add-on validity are checked server-side.

For each departure, enter planning caps in passenger-entitlement units for the package and every component. These caps are not live room/seat availability and do not reserve supply. Reconfirm them after each definition/publication version change. Preview shows the minimum current-version cap and whether the party fits; actual availability/confirmations remain unknown. Unconfigured/stale plans are shown as unknown, not zero supply. Every planning update captures before/after values in immutable history; failed audits roll back both inventory and history writes.

Migration 081 creates Packages-owned definitions/history/replay and Inventory-owned allotment planning records. Existing seat/room reservation behavior remains unchanged. Full FR-11 is incomplete: supplier reservations, compensation after failures, fulfillment and supplier confirmations require authorized component-provider API contracts and sandbox configuration. Provide the hotel/transport/activity supplier names, documentation and secure configuration location; do not paste secrets into chat or package fields.

Tests: `tests/package-administration.test.ts`. Evidence: `docs/evidence/package-management-*`. Browser acceptance and live multi-supplier booking are not claimed.
