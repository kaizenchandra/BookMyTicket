CREATE TABLE bookings.pending_cancel_previews (
 id uuid PRIMARY KEY,
 order_id uuid NOT NULL UNIQUE REFERENCES bookings.orders(id),
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 payment_activity boolean NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '2 minutes'
);
CREATE TABLE bookings.pending_cancellations (
 order_id uuid PRIMARY KEY REFERENCES bookings.orders(id),
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE bookings.pending_cancel_commands (
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 order_id uuid NOT NULL REFERENCES bookings.pending_cancellations(order_id),
 PRIMARY KEY(owner_id,operation_key)
);
