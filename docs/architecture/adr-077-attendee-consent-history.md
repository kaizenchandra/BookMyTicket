# ADR 077: Saved attendee consent history

FE:PRO-04 and BE:CUS-05/06 require explicit storage consent and purpose/version/time/withdrawal tracking. GET /api/v1/profile/attendees/consent-history now exposes the signed-in account's retained consent metadata. A panel beside saved attendee controls shares history navigation with marketing consent while keeping purpose-specific labels and explanations.

The Profiles adapter reads only account-scoped consent rows, not saved attendee ciphertext. Responses include purpose, policy version, grant flag, preference version and recorded time. Names, contacts, attendee IDs and account IDs are excluded. History is available without the encryption key and after withdrawal has cleared saved details. Existing booking records are unaffected.

Pagination uses the existing account/preference-version primary key, descending versions, strict bounded beforeVersion and 20-item pages. Recipient/account query overrides are rejected. Migration 066 preserves existing rows and rejects UPDATE/DELETE of attendee consent history. Saving attendee details still records consent with each successful versioned save; repeated true entries can represent continued consent while editing shortcuts, not separate marketing subscriptions. Identical immediate retries remain deduplicated.

The shared history panel loads explicitly, refreshes opened history after successful saves, supports First/Previous/Next and clears data on session changes. Saved-attendee and marketing purposes remain separate. History does not restore details or imply current storage permission. Default no-consent state is not backfilled.

Tests perform 24 real alternating saves/withdrawals with retries, verify 20+4 pages, deleted ciphertext, key-independent metadata access, omission of private values, owner isolation, validation and immutability. Initial-render tests verify separate purpose labels and explicit history loading for both panels. Browser interaction/session/accessibility, historical policy text and approved retention/deletion handling remain open.
