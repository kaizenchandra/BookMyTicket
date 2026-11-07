# ADR 016 — Published catalog filters and keyset navigation

Catalog discovery now supports recently-added and title ordering, exact language/genre/format filters, actual published facets, counts, and keyset pagination. Cursors bind to normalized filters/sort and preserve database microseconds; SQL ordering has a unique ID tie-breaker. Invalid or changed-filter cursors return 422 and the UI provides a first-page recovery link. Counts/facets are separate current reads, not a frozen catalog snapshot. Publication changes between pages can legitimately alter results.

Search treats SQL wildcard characters literally. Suggestions contain at most four published listings per category, optional city scope and distinguishing metadata. The frontend debounces requests, aborts stale responses, implements arrow/Enter/Escape selection and retains normal form submission as fallback. Filters and next-page position are shareable; city/filter changes reset the cursor. Actual browser keyboard/a11y acceptance is blocked by unavailable browser host.

Migration 021 adds city/recent and title ordering indexes. No performance claim is inferred from creating indexes. Facets are bounded to 300 distinct key/value pairs. Artist/venue/entity search, date/price/accessibility filters, complete mobile filter drawer behavior, relevance ranking and production load verification remain required.

Evidence: tests/discovery.test.ts; the complete passing cinema-sports-full-suite/container-tests evidence includes these tests. The first full run failed two email tests because the Docker/Mailpit stack was stopped; restoring it resolved those dependency failures.
