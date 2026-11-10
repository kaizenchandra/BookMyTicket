# ADR 093: Payment history category and attempt filters

FE:BKG-03, BE:BKG-13 and BE:API-05 are advanced by filtering the existing owner-only payment history. This changes retrieval only, not payment or booking transitions.

The API accepts category=all|captures|recovery|attempts, defaulting to all. An optional attemptId is a random public attempt UUID and requires category=attempts. UUID case is normalized. The Payments public contract carries these selections; its adapter applies them to the capture/recovery/observation union before the twenty-item page limit. Unknown or another booking's attempt reference returns an empty owned result, never data from that booking.

Cursors now bind category and attempt ID as well as booking. Reusing a cursor with different filters returns 422 and asks the caller to restart from the newest page. Earlier cursors lacking selection fields remain valid for the unfiltered view only. Exact event ordering and provider-data redaction are unchanged. Existing owner checks happen before reading payment history.

The frontend offers explicit Apply/Clear controls, record-type selection, and an optional attempt reference field for attempt observations. Applied filters are displayed separately from draft inputs. Applying or clearing resets pagination; older/newest navigation preserves applied filters. Empty/error/retry states remain available. Account/booking component identity prevents carrying private data into another account.

Tests exercise twenty-plus-five capture pages, twenty-plus-four attempt pages, one-attempt grouping, uppercase UUID normalization, recovery and empty results, cross-booking isolation, malformed input, cursor filter mismatches and legacy unfiltered cursors. Build and server-rendered checks cover control availability; browser interactions/accessibility and load acceptance remain open. No migration is required.
