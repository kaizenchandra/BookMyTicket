# ADR 078: Retained consent wording

BE:CUS-06 and FE:PRO-04/08 require meaningful consent records and clear purpose separation. New marketing and saved-attendee consent entries now retain the version-1 consent statement used by the first-party forms. A domain constant supplies the existing wording to both UI and persistence, preventing accidental divergence between those two paths. Published wording changes require a new policy version.

Migration 067 adds nullable bounded policy_text columns to both existing immutable consent-history tables. New application writes store the canonical statement in the same transaction as the preference/consent change. History APIs return policyText as a string or null. Existing rows remain null; current wording is never substituted for missing historical evidence. Older application instances may also leave null during a rolling upgrade.

History panels show retained text inside an expandable Recorded consent wording control and explicitly identify unavailable text. Rendering uses React text escaping and preserves line breaks. Immutable history triggers prevent later replacement of snapshots. The retained statement is not a copy of the entire page, proof that a particular client displayed it, or evidence of external communication delivery. API clients must display the applicable policy themselves; caller-supplied text is not accepted.

Tests assert exact new snapshots for both purposes, null legacy projections, snapshot-update rejection and escaped rendering with explicit missing-text behavior. Existing pagination, account isolation, withdrawal privacy and retry checks continue to pass. Legacy text reconstruction, approved retention/deletion handling, future policy-version rollout and browser/accessibility acceptance remain open.
