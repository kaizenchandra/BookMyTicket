# Public venue pages

Open a listing's showtimes and follow Venue details, or follow Venue details and directions from seating. The frontend route is /venue/:id; GET /api/v1/venues/:id provides the public response. The optional after cursor continues up to 20 future sessions per page. Invalid or mismatched cursors return 422; return to First sessions to recover. Retry handles transient load errors.

If a venue returns 404, check its provider approval, venue ownership, published listing state and session projection association. Unscheduled venues are deliberately private. Historical published sessions permit venue details with no upcoming sessions. Do not publish a listing or approve a provider merely to bypass this check.

Migration 041 runs with the normal migration command and backfills existing snapshot venue IDs. New sessions populate this mapping transactionally. Investigate missing mappings against the owning Inventory snapshot and repair through a reviewed projection rebuild; never change reservation ownership to repair discovery. Projection results never authorize a sale.

Verification: tests/venues.test.ts covers unscheduled/private venues, 23-session traversal, exact page sizes, invalid/scoped cursor rejection, approval revocation, listing withdrawal and historical empty results. Evidence is docs/evidence/public-venues-{tests,full-suite,container-tests,build,deploy,smoke}.txt. HTTP shell checks do not establish browser visual or keyboard acceptance.

Still outstanding: contact permissions and fields, photos/maps uploads, transport/parking guidance, venue entry policies, independent venue publication and browser/accessibility acceptance. External directions use a third-party service; manual address entry is available without device location.
