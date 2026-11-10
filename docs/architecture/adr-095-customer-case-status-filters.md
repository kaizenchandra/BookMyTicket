# ADR 095: Customer case status and category filters

FE:SUP-C-04, BE:SUP-02 and BE:API-05 are advanced by customer list filters for existing case states and categories. The API continues to return only the authenticated owner's cases.

GET /api/v1/cases accepts optional state (open, in_progress, escalated, resolved) and category (booking, payment, accessibility, other). They combine with bookingId and apply before the 100-item page limit. Unknown values are rejected. Applied status/category selections are added to cursor scope; changing either invalidates the old cursor. Existing unfiltered and booking-only cursor representations remain unchanged.

The frontend exposes a labeled GET filter form with explicit Apply/Clear. Applying filters starts at newest cases, preserves the booking reference and uses existing unsent-draft confirmation before navigation. List categories do not alter the separate new-case category field. Page/conversation/back links retain the selections. Clear status/category retains the booking filter; clear booking retains status/category.

While viewing a specific conversation, the frontend requests the exact case and optional booking constraint without state/category predicates. Their URL values are retained only for returning to the list. This avoids hiding a conversation when a reply/escalation changes its state. API callers can still explicitly combine exact-case and other filters as intersections. The exact-case/after exclusivity remains in force.

Tests cover 102 matching cases beyond the page limit, state/category/booking intersections, changing cursor scope, status changes between pages, valid empty results, invalid enums, exact-case availability after resolution and context-preserving form/links. No migration is needed. Browser unsent-draft/back-navigation/accessibility, load, attachments and broader support acceptance remain open.
