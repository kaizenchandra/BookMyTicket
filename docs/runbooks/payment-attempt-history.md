# Payment attempt observations

The booking Payment history panel now includes newly retained attempt observations. Attempt observed as created/authorized/captured/refunded/failed describes a state accepted by the platform's existing reconciliation policy. The random Attempt reference groups observations for the same attempt without exposing provider payment identifiers.

Recording times use India-time display and are not provider event timestamps. Polling an unchanged state adds no record. Ignored stale regressions add no record. Earlier transitions before migration 071 are unavailable; a legacy attempt can therefore first appear at a later observed state. An observed refund status is not a complete booking refund ledger or a guarantee of booking confirmation.

The existing owner-only GET /api/v1/bookings/:id/payment-history endpoint includes five new attempt_* kinds and optional nullable attemptId. Existing capture/recovery records have attemptId=null. Preserve the returned cursor for older pages; original cursor kinds remain supported. Clients using a closed kind enum must adopt the updated API contract.

Migration 071 adds stable attempt timeline IDs and immutable observation records. History is written atomically by a Payments persistence trigger on attempt insert/actual state change. Do not disable it or delete observations to repair a stuck payment; use existing authorized reconciliation/recovery workflows. No observation history was backfilled from current state.

Evidence prefix: docs/evidence/attempt-history-. Live provider operation, historical reconstruction, full refund/disruption history, retention, browser/accessibility and load acceptance remain open.
