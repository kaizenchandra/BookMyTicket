# Customer booking history

Open /bookings after signing in. Search by full or partial booking reference or a saved listing title. Choose a booking status and, optionally, confirmed upcoming/in-progress or past experiences. Creation-date controls use India time: From includes midnight on that date; Before excludes midnight on its date.

Older bookings without saved titles display their reference and any saved venue/session details. They are not backfilled with today's title. Open a booking for separate payment, ticket and refund information. History does not authorize admission or promise cancellation eligibility.

Older bookings loads the next 25 records. Refresh first page returns to current results. Changing filters resets pagination. Network/validation/authentication errors retain input and offer retry. Sign-in/session changes clear private results.

Migration 030 is additive. Rollback to the prior artifact can retain indexes and optional snapshot titles. Production index creation needs a separately reviewed migration window for large tables. No production deployment or performance claim is made.

Verification evidence: docs/evidence/booking-history-*. Browser host unavailable; UI interaction and accessibility remain unverified.
