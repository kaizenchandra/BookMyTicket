# ADR 005 — Versioned physical plans and space scheduling

Venues owns addresses, venue-local time zones, physical spaces and immutable seating-plan versions. Inventory owns occurrence capacity, reservations and sales. Creating a new plan never rewrites an occurrence or its sold assignments. Space physical capacity is fixed in this slice; reductions and migration require a later explicit remediation workflow.

Scheduling consumes a public Venues contract inside one local transaction: lock space, validate plan ownership and configuration, validate approved provider/published listing, reject overlap including turnaround, persist the occurrence's exact plan and venue snapshot, and derive resources from that plan. Prices must cover exactly the plan resources. Retry identity is actor + operation key with input fingerprint. All new scheduling must use this path; legacy rows remain readable without fabricated plan versions.

Provider plan creation uses expected space version; one concurrent edit wins. Domain validation rejects duplicate IDs/labels/positions, invalid capacity, broken companion references and invalid geometry. Explicit-offset occurrence timestamps disambiguate local time. No automatic timezone guess is used for non-India scheduling. Existing historical snapshots are preserved.

Reference: PostgreSQL row locks and consistent lock ordering, checked 2026-11-05: https://www.postgresql.org/docs/current/explicit-locking.html

Acceptance scope: BE:VEN-02–09/11/12, BE:CIN-04/06, BE:SCH-01–04/08, FE:CAT-09–14, FE:SEA-01–06, FE:OPS-C-01/02. This slice does not complete physical layout imports, destructive plan migration, bulk schedules, recurring sessions, or all cinema/event/sports-specific fields. Browser fidelity remains unverified.

Database guards also reject silent changes to a space's physical capacity/turnaround and an occurrence's plan snapshot. These changes must be implemented through a dedicated remediation workflow in a future migration. They cannot be achieved through an operational override. Ordinary occurrence lifecycle changes remain separate.

The current editor supports at most 1,000 assigned seats/admission areas per version (large general-admission capacities can be represented as pools). The plan endpoint accepts up to 1 MiB; other requests retain the smaller body limit. Bulk import and large-map editing remain required follow-up work. Organization listings are currently bounded to 100 venues, 500 spaces/plans and 100 occurrences; provider cursor pagination is still outstanding. These bounds are not claims of full stadium workflow acceptance.

Public schedule creation now requires planId and Idempotency-Key instead of arbitrary venueName/timeZone/resources. This replaces an unfinished development contract, not a backward-compatible production API rollout. Legacy stored occurrences remain readable and explicitly identify missing plan metadata; no plan is fabricated for them.
