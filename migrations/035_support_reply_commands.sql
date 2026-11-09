CREATE TABLE support.reply_commands (
 actor_id uuid NOT NULL,
 channel text NOT NULL CHECK(channel IN ('customer','staff')),
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,channel,operation_key)
);
