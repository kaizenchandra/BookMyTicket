# ADR-002 — Immutable commercial quotes and order acceptance

Status: implementation. No production commercial rates have been approved.

Pricing owns immutable policy versions, occurrence-policy assignments and immutable INR quotes. Policies are configured explicitly by staff with `pricing` permission and MFA; no policy is seeded outside isolated tests. Policy terms must include cancellation/admission text. Changing a policy creates a new version; an optimistic assignment update controls when it applies. Rates use integer basis points and amounts use integer paise. BigInt intermediate arithmetic and half-up rounding avoid floating-point monetary error. Order-level fees are allocated by largest remainder to individually identified admission units, with stable unit-key tie breaking. Inclusive and exclusive ticket/fee taxes are explicit.

A quote is bound to its owner, reservation, policy version and exact reservation items. It expires at the original hold deadline. Repeated quote requests reuse the same quote under the same policy and never extend expiry. No coupon, extras or cross-occurrence package support is implied by this slice.

Acceptance rechecks live reservation ownership, sales state and published listing under the protected operation; locks the current policy assignment; compares quote identity/content; records exact policy acknowledgment and an immutable snapshot. One order per reservation preserves uniqueness beyond operation-key retention. Actor-scoped idempotency keys and request fingerprints reject changed commands. Retrieving a prior successful outcome does not require the hold to still be active.

Lock order: actor/operation advisory locks → occurrence gate → reservation → policy assignment → quote. Confirmation keeps order → occurrence → reservation → resources. Placement does not lock an existing order after locking a reservation; it reads previous outcomes before consuming these locks, avoiding an order/reservation inversion. No network operation occurs in quote or acceptance transactions.

This stage creates a `pending_payment` order only. It never claims a paid booking, starts a live charge or fabricates a free payment. Production payment initiation remains gated by the unfinished commercial and provider workflows. Free-order fulfillment is a separate pending use case.

Sources rechecked: [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [database constraints](https://www.postgresql.org/docs/current/ddl-constraints.html). These support the chosen transaction mechanics; they do not establish legal tax rates or product policies.
