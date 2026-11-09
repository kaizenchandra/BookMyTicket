# ADR 076: Customer marketing consent history

BE:CUS-06 requires purpose/version/time/withdrawal tracking; FE:PRO-03/08 require communication preference management and separation from required messages. Existing consent records are now exposed to their owner through GET /api/v1/profile/communications/history and an explicit-load history panel beside communication preferences.

The Profiles application port queries only the authenticated account. No owner query parameter is accepted. Responses include purpose, policy version, granted/withdrawn flag, preference version and timestamp; account IDs, contacts and internal history IDs are omitted. Newest preference version comes first, with a strict beforeVersion boundary and 20-item pages. The existing unique account/preference-version index supports ordering. Bounded canonical integer validation prevents malformed or overflowing cursors.

Migration 065 makes marketing consent history append-only by rejecting UPDATE/DELETE. Existing rows are preserved. Preference saving still writes consent history only when marketing permission changes, atomically with preferences. Identical immediate retries and language-only changes do not create consent entries. Viewing history does not change permission or communicate externally. Default opt-out is not backfilled as an explicit withdrawal; an empty history is not proof of consent.

The frontend loads history on request, supports First/Previous/Next and refresh, and refreshes opened history when saved preference version changes. It labels grants and withdrawals, policy and preference versions, and recorded time. Session changes clear loaded records and pagination and invalidate stale responses. Records describe consent events, not email delivery or current permission; current preference controls remain separate.

Tests create 23 actual alternating saves with identical retries, traverse 20+3 pages, check language-only omission, owner isolation, projected fields, malformed boundaries, authentication and immutability. Historical policy text, approved retention/deletion handling, browser/session/navigation/accessibility and external marketing delivery remain open.
