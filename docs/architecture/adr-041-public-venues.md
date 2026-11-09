# ADR 041: Public venue discovery

Venues owns venue details. Its PublicVenue application use case combines a venue repository with Providers OrganizationAccess and Catalog PublicVenueSessions public contracts. Catalog owns the rebuildable session discovery projection; Inventory remains the sale authority. No runtime adapter reads another module's private tables.

Migration 041 adds venue_id to the projection, backfills valid UUIDs from existing occurrence snapshots and indexes venue/start/occurrence. Scheduling writes the venue ID through the existing CatalogSessions contract in the scheduling transaction. Discovery pages contain at most 20 open future sessions of published listings owned by the venue organization. An exact PostgreSQL timestamp and occurrence UUID form a stable boundary; the cursor is scoped to venue and organization. Cursors are not authorization credentials. Pages reflect current data, not a frozen snapshot.

A venue is public only when its provider is approved and at least one projected session belongs to a currently published listing from that provider. A venue with only historical sessions can show an empty upcoming list. Unscheduled, unpublished-only and suspended-provider venues return 404. A separate venue publication lifecycle remains future work. Provider/publication reads are point-in-time checks, not a cross-module database snapshot.

The public response excludes organization ownership and internal plan data. Availability, sales windows and purchase limits remain checked by Inventory when selecting/reserving tickets. The UI does not claim that a projected occurrence guarantees inventory. Venue-wide amenities/accessibility are separate from the instruction to review session-specific terms.

Directions use an encoded address with the official Google Maps URL API, api=1, and a 2048-character limit. No geolocation permission is requested; the address remains available if external maps cannot open. Reference: https://developers.google.com/maps/documentation/urls/get-started .

Contact, photographs, transport/parking guidance, venue entry policies and full browser/accessibility acceptance remain outstanding. Existing fields and missing-data fallbacks are used without inventing venue information.
