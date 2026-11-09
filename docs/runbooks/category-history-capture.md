# Additional category history capture

Future cinema saves retain crew. Event saves retain organizer, inclusions, exclusions and entry instructions. Sports saves retain season, individual teams and hospitality. These supplied customer-facing fields are stored in current Catalog metadata together with the category's own details, using the existing transaction.

Once that saved listing is revised, submitted or reviewed, its pre-change snapshot includes these fields. Open saved revisions on the existing member/moderator history pages to inspect or compare them. Missing values in older snapshots remain Not recorded; no historical backfill occurs.

Identical category command retries preserve the previous fingerprint and do not update content or create revisions. To change content, use the existing versioned edit form with a new command key. Reusing a key with changed crew, exclusions or hospitality still conflicts. An old successful command replay is not a way to populate newly retained fields.

No migration or seed is required. CategoryDrafts callers supplying a canonical requestFingerprint must include every field in that hash; retainedMetadata is a derived projection excluded from the legacy fingerprint envelope for compatibility. Callers without such a fingerprint retain full-input hashing.

Evidence prefix: docs/evidence/category-history-capture-. Previously missing historical values, media history, browser/accessibility acceptance and retention/restore policy remain open.
