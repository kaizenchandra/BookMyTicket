# Saved attendee consent history

In /profile, use View consent history below saved attendee controls. Entries show storage permission granted or withdrawn, policy version, preference version and recorded time. Next/Previous/First page and refresh are available. Opened history refreshes after saves or withdrawal.

History contains no saved attendee names, contacts or identifiers. It remains readable after withdrawal deletes saved shortcuts and does not require the decryption key. Existing booking records remain unchanged. Repeated grant records may reflect edits saved with continued consent. No history does not imply permission was granted.

GET /api/v1/profile/attendees/consent-history is scoped to the authenticated account. Follow nextCursor as beforeVersion for older pages of up to 20 records. Positive canonical integer boundaries up to 2147483647 are supported. Unknown parameters, including account overrides, are rejected.

Apply migration 066 through the existing migration service. Do not edit/delete consent records to change permission; use the saved attendee withdrawal flow. Approved retention/deletion handling is a separate outstanding workflow. No seed, new grants or external communications are required.

Evidence prefix: docs/evidence/attendee-consent-history-. Browser/session/accessibility and historical policy/retention acceptance remain open. See ADR 077.
