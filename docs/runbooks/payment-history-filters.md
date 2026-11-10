# Filtering payment history

On a booking's Payment history panel, select All payment records, Captures, Recovery records or Attempt observations. For a single attempt, choose Attempt observations and copy its Attempt reference into the optional field. Select Apply payment filters. Clear payment filters restores all records.

Changing draft controls does not change results until Apply. The applied view is shown above the results. Applying/clearing starts from the newest page; older-page navigation preserves the selection. An empty result means no matching retained records, not proof that no payment activity occurred.

GET /api/v1/bookings/:id/payment-history accepts category and optional attemptId alongside after. attemptId requires category=attempts and must be a public UUID, not a provider reference. Preserve all applied filters when using nextCursor. Changed filters require a fresh first page; old unfiltered cursors remain valid only for category=all with no attempt reference.

Ownership checks, no-store, redaction and current payment/booking semantics are unchanged. No migration is needed. Evidence prefix: docs/evidence/payment-filters-. Browser/accessibility, load and broader refund/disruption history remain open.
