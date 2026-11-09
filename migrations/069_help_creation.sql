CREATE TABLE catalog.help_creations (
 article_id text PRIMARY KEY REFERENCES catalog.help_articles(id),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 fingerprint text NOT NULL, snapshot jsonb NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER immutable_help_creation BEFORE UPDATE OR DELETE ON catalog.help_creations FOR EACH ROW EXECUTE FUNCTION catalog.immutable_help_save();
