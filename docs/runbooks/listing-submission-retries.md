# Listing submission recovery

Use Submit for moderation in the provider catalog workspace. If the response fails or is lost, Retry original submission resends the captured listing reference and version. The UI displays both; Dismiss retry removes the local attempt. The same authorized actor receives the original result without repeating submission. Success refreshes current status because later reviews may already have occurred.

Another actor submitting the same already-consumed version receives CONFLICT. A viewer or revoked member cannot replay a prior submission. A new submission requires an approved provider and the current draft/changes-requested version. Old replay never reopens, republishes or reverses newer listing states.

POST /api/v1/listings/:id/submit accepts a positive integer version no greater than 2147483646. Identity is scoped by listing/input version and the original actor; the request has no other mutable payload. Migration 054 persists immutable original results in catalog.submissions atomically with listing revisions/state. Do not edit/delete records to fix a conflict.

Submissions before migration 054 are not backfilled. The frontend attempt is in memory; after browser closure, refresh and inspect the current listing before taking action. No migration fixture, staff grant or external notification is created.

Evidence prefix: docs/evidence/listing-submit-retries-. Browser retry/accessibility, retention approval and generic draft-edit retry recovery remain open.
