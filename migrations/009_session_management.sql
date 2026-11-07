ALTER TABLE identity.sessions ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE identity.sessions ADD CONSTRAINT session_public_id UNIQUE(id);
-- Historical login time was not collected; do not invent it for existing sessions.
ALTER TABLE identity.sessions ADD COLUMN created_at timestamptz;
ALTER TABLE identity.sessions ALTER COLUMN created_at SET DEFAULT now();
CREATE INDEX session_account_expiry ON identity.sessions(account_id,expires_at);
