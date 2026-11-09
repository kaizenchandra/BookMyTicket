# Venue photos and maps

In /partner/venues, select an organization and open Edit venue photos and maps. Add up to eight externally hosted HTTPS images you are authorized to publish. Choose photo/map, describe the image, provide a caption/credit where appropriate, and order entries with Move up/down. Toggle preview, then Load image to inspect a hosted asset. Save images persists the whole list. Remove an entry and save to withdraw it; saving an empty list removes all references.

Public venue pages show supplied descriptions and credits immediately. Image requests occur only when the viewer selects Load image; that external host receives their network address. The no-referrer image request omits the referring page. Failed loads retain descriptions and offer retry. The application does not verify host availability, content or licensing and sends no server-side network request to supplied URLs.

Writable organization membership is required. On 409, copy the draft, reload and compare the latest version before saving. An uncertain earlier save may already have succeeded. Failed saves retain the in-memory draft; no durable draft storage exists. Only venues passing existing approval/publication gates expose media. Already loaded browser pages cannot be recalled after removal.

Migration 044 initializes media as empty and version 1. Audit action venue.media_updated records version/count without raw URLs or text. The update and audit are atomic. Native, Docker and render-test evidence is under docs/evidence/venue-media-. No external assets are fetched by the automated tests.

Outstanding: file upload, crop/optimization, controlled storage, moderation, live external-image/browser/keyboard/accessibility verification and independent venue publication. Full catalog media requirements remain partial.
