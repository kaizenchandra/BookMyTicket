# Customer marketing consent history

In /profile, open Language and communications, then View consent history. Entries show optional marketing email permission granted or withdrawn, consent policy version, preference version and recorded time. Use Next/Previous/First page and Refresh consent history. Saving new preferences refreshes an already opened history.

History does not prove email delivery or change required transactional communications. Current permission remains in the preference form. An empty history means no recorded change; it does not imply permission was granted. The initial opt-out default is not reconstructed as an explicit withdrawal.

GET /api/v1/profile/communications/history is scoped to the signed-in account. It returns items (maximum 20) and nextCursor. Send nextCursor as beforeVersion to retrieve older records. Only positive canonical integer values up to 2147483647 are accepted; unknown parameters are rejected. Never supply another account ID.

Apply migration 065 before serving this release. It preserves existing data and makes consent rows immutable. Do not edit/delete history to correct preferences; use a new preference change. Retention/deletion workflows require a separate approved design. No seed, grants or external messages are required.

Evidence prefix: docs/evidence/consent-history-. Browser/session/navigation/accessibility acceptance, historical policy text and retention remain open. See ADR 076.
