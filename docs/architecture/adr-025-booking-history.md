# ADR 025 — Searchable customer booking history

Scope: FE:BKG-01/02/17 and BE:BKG-03/13 subsets. No completion of partial cancellations or status timelines is claimed.

The customer history route remains /bookings and GET /api/v1/bookings. The Bookings application query port returns at most 25 owned orders with saved occurrence metadata, separate booking state, total and server retrieval time. Search matches a literal case-insensitive fragment of the reference or saved title. Status and inclusive/exclusive creation-date filters combine with upcoming/past filters. Date controls use India midnight; session display preserves each saved venue time zone.

Confirmed bookings are upcoming/in progress while at least one saved session end is after database statement time; they are past only when all saved session ends are known and no later than that time. Bookings without session metadata are not silently classified. Pending, cancelled and refund-required states remain separate; combining a timing filter with a non-confirmed status yields no matches. These are historical schedule views, not current admission or disruption eligibility.

The cursor binds the owner and normalized filters and carries the exact PostgreSQL microsecond timestamp plus UUID. Keyset ordering resolves timestamp ties without offset drift. Every request authenticates and filters by current account. This is not a database snapshot: state changes/time passage may change membership between pages; refresh the first page for current results. Filters are kept in component memory, not public URLs or persistent storage.

Catalog supplies the published title through its public contract under a shared row lock. Inventory includes it in the quote snapshot and Bookings preserves that accepted snapshot. No historic orders are rewritten; titles absent in earlier bookings remain absent and those orders can be searched by reference. Listing renames cannot change saved history. The strict quote response contract accepts the optional title for compatibility with older snapshots.

Migration 030 adds owner/time/ID and owner/state/time/ID indexes. No financial, reservation, admission or cancellation transition is added. The frontend clears private history on session/account changes and ignores superseded responses. Existing theme tokens and semantic forms/cards are reused.

Real PostgreSQL/HTTP verification covers owner isolation, unknown inputs, literal wildcard text, timestamp boundaries, status/timing filters, 28 equal-microsecond orders across pages, cursor scope, strict response contracts and listing renames after acceptance in cinema/sports/event journeys. Browser host is unavailable; interactive, accessibility and viewport acceptance remain open.
