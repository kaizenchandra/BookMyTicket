# Mark displayed notifications unread

In /notifications, use Mark displayed read notifications as unread to reset only read notifications currently shown. Category and status filters determine the displayed page. Notifications on other pages are untouched. The page and inbox unread count refresh after success; items leave the Read view when marked unread.

POST /api/v1/notifications/unread accepts {"ids":[...]} with one to twenty distinct UUIDs. All IDs must belong to the signed-in account. Any missing/foreign item returns 404 with no selected records changed; malformed, repeated or oversized selections return 422. Success returns sorted canonical IDs and read=false. Repeating the same request is harmless unless an intervening action changed state; read/unread operations set current state rather than replaying historical outcomes.

No migration, seed, grants or external messages are needed. Evidence prefix: docs/evidence/notification-bulk-unread-. Browser multi-action/accessibility and load acceptance remain unverified. See ADR 081.
