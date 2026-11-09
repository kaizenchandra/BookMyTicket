# Recorded consent wording

Open either consent-history panel in /profile. New entries expose Recorded consent wording; expand it to read the retained statement associated with that grant or withdrawal. Earlier records explicitly say the wording was not retained. Current policy wording is never backfilled into older records.

Both history APIs add nullable policyText. Clients should render the string as text and display an unavailable indication for null. The statement describes the consent purpose; it is not evidence that marketing emails were sent or that a particular external client showed the text.

Apply migration 067 before serving the release. The migration adds nullable columns without changing historical rows. New saves retain canonical version-1 wording atomically. Existing history remains immutable. Future wording changes need a new version and a deliberate rollout; do not edit published constants in place or rewrite old records.

No seed, new grants or external messages are needed. Evidence prefix: docs/evidence/consent-wording-. Legacy text, approved retention/deletion, future-version rollout and browser/accessibility acceptance remain open. See ADR 078.
