ALTER TABLE identity.accounts ADD COLUMN admin_version integer NOT NULL DEFAULT 1 CHECK(admin_version>0);
CREATE INDEX admin_account_page ON identity.accounts(created_at DESC,id DESC);
CREATE INDEX admin_booking_page ON bookings.orders(created_at DESC,id DESC);
