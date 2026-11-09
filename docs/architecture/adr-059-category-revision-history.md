# ADR 059: Allowlisted category details in revision history

FE:CAT-06 and BE:CAT-07 require useful history for category listings. Catalog revisions already retain selected category data in listing metadata, but the history and comparison projections discarded it. A Catalog domain projection now selects core text and category fields from the saved snapshot's kind, using the same projection for history and comparison. This reads only Catalog's own snapshots, not another module's private tables or mutable current details.

Allowed movie fields: language, genre, format, certification, duration, performers and releaseDate. Allowed event fields: language, genre, duration, performers and minimumAge. Allowed sports fields: sport, competition, teams and entryInstructions. This matches the metadata retained by existing category write adapters. Missing/non-string values become null; empty strings remain empty. Unknown kinds expose no category details. Cross-kind fields, arbitrary metadata, internal managedBy/fingerprints, URLs and unrecognized keys are excluded. Raw snapshots remain internal to the persistence adapter and are projected before returning or comparing.

History adds categoryDetails to the safe snapshot contract. Comparisons add stable categoryDetails.FIELD difference keys after core fields. Fields absent on both sides produce no difference; null and empty text remain distinct. All existing membership/moderation/MFA checks, access audits, immutable rows and string pagination remain unchanged. Audit comparison metadata contains field names, not values.

Frontend revision cards show labeled category details, including Not recorded and Empty text. The comparison table uses the same labels. Supplied text remains escaped. Scope notices describe supported saved details rather than claiming full category history.

No migration or historical reconstruction is required. Crew, season, hospitality and any other data not retained in these Catalog metadata snapshots remain unavailable. Their authoritative modules would need an explicit historical contract/capture policy to extend coverage; current mutable rows must never fill historical gaps.

Tests cover history and comparison API responses for all three kinds, unrelated/internal/URL/cross-kind omission, malformed/non-string metadata, unknown/prototype-like kinds, null/empty semantics, labels and HTML escaping. Full browser/accessibility acceptance, unsupported category-field history and retention approval remain open.
