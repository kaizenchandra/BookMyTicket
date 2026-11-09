# Venue guidance

In /partner/venues, choose the organization and open Edit venue guidance. Edit amenities, accessibility, transport, parking and venue entry policies, then Save guidance. These are current venue-wide informational details; keep session-specific restrictions and accepted booking terms in their existing workflows. Fields can be cleared and public pages show an explicit unavailable-information fallback.

Only members with write access can save. A 409 means another edit won or an earlier save may have succeeded. Copy any unsaved draft, reload, compare the latest content, then apply the intended changes. Do not retry with a fabricated version. A failed request retains entered text; successful save refreshes organization data. No durable draft storage is provided.

Existing venues start with empty travel/policy fields and guidance version 1 via migration 042. Public visibility still requires provider approval and published catalog association. Staff can inspect venue.guidance_updated through existing authorized audit tooling; free text is excluded from audit metadata. Failed audit persistence leaves venue fields/version unchanged.

Evidence: docs/evidence/venue-guidance-{tests,full-suite,container-tests,build,deploy,smoke}.txt. Browser visual, keyboard and accessibility acceptance remains unverified. Contact permission rules, photographs/maps and independent publication remain open.
