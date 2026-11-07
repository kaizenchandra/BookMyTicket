CREATE INDEX active_reservations_expiry ON inventory.reservations(expires_at,id) WHERE state='active';
