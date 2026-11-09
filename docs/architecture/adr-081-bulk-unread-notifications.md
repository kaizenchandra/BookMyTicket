# ADR 081: Mark displayed notifications unread

FE:ENG-04 and BE:NTF-11 require notification read/unread state. POST /api/v1/notifications/unread accepts one to twenty distinct notification UUIDs and returns canonical sorted IDs with read=false. It mirrors the existing bulk-read route and shares its strict request validation.

The Notifications application port delegates to a shared transactional read-state operation. Selected owner-scoped rows are locked in deterministic ID order. If any requested ID is unavailable, the whole selection fails before any update. Otherwise read_at becomes null for exactly those IDs. Existing bulk-read behavior still preserves an already-read timestamp. Repeated same-state requests are harmless; these are current-state setters, not historical command replay, so a later opposite action may change state again.

The frontend sends only currently displayed read IDs and offers Mark displayed read notifications as unread alongside the existing bulk-read action. Both disable while loading, on errors, during updates or without eligible displayed records. Success refreshes current filters/counts, so items can disappear from the Read view. Unseen pages are never selected implicitly.

Tests cover mixed-owner/missing-record rollback, case-insensitive duplicate rejection, empty/oversized input, concurrent reversed selections, repeated updates, untouched records, unread counts and authentication. No migration is required. Browser multi-action/filter/accessibility and load acceptance remain open.
