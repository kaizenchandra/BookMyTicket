CREATE TABLE bookings.free_confirmations (
 order_id uuid PRIMARY KEY REFERENCES bookings.orders(id),
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings.free_confirmation_commands (
 owner_id uuid NOT NULL REFERENCES identity.accounts(id), operation_key text NOT NULL,
 order_id uuid NOT NULL REFERENCES bookings.orders(id), PRIMARY KEY(owner_id,operation_key)
);
