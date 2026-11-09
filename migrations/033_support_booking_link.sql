ALTER TABLE support.cases ADD COLUMN booking_id uuid;
CREATE INDEX support_booking_lookup ON support.cases(booking_id) WHERE booking_id IS NOT NULL;
