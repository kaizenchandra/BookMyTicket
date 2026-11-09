CREATE TABLE support.assignment_commands (
 actor_id uuid NOT NULL,
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,operation_key)
);
