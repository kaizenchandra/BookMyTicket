CREATE TABLE bookings.free_cancel_previews (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bookings.orders(id), owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 fingerprint text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE bookings.free_cancellations (
 order_id uuid PRIMARY KEY REFERENCES bookings.orders(id), owner_id uuid NOT NULL REFERENCES identity.accounts(id), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings.free_cancel_commands (
 owner_id uuid NOT NULL REFERENCES identity.accounts(id), operation_key text NOT NULL, fingerprint text NOT NULL,
 order_id uuid NOT NULL REFERENCES bookings.orders(id), PRIMARY KEY(owner_id,operation_key)
);
