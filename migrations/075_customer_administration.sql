ALTER TABLE identity.accounts ADD COLUMN contact_verified_at timestamptz;
ALTER TABLE identity.accounts ADD COLUMN customer_flags text[] NOT NULL DEFAULT '{}'
 CHECK(customer_flags <@ ARRAY['review_required','contact_support','payment_review']::text[]);
CREATE INDEX customer_booking_activity ON bookings.orders(owner_id,created_at,state);
