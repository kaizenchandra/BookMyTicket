# Booking-linked support cases

In /cases, enter the full booking reference from My bookings when the question concerns a booking. Leave it blank for general help. Only a booking in the signed-in account can be linked. Do not enter payment secrets, OTPs or card data.

The saved case shows View linked booking. Authorized support agents opening the case in /operations see a restricted current booking summary. Payment, refund and ticket status remain separate and are not inferred from that summary.

A missing/foreign booking produces the same not-found error and creates no case. A malformed reference produces validation feedback. Existing cases are not automatically linked or rewritten. Attachments, payment/refund-specific linking and full operational timelines remain pending.

Migration 033 is additive; prior application code can ignore the nullable column during rollback. Preserve linked booking history during retention planning. Evidence is in docs/evidence/support-booking-*. No live provider processing is verified by these tests.
