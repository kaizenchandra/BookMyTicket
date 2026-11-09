CREATE TABLE support.creation_commands (
 owner_id uuid NOT NULL,
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(owner_id,operation_key)
);
