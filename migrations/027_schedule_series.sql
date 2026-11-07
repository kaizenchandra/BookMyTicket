CREATE TABLE inventory.schedule_series (
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 occurrence_ids jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,operation_key)
);
