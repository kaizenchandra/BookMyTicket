CREATE TABLE providers.creations (
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 operation_key text NOT NULL CHECK(char_length(operation_key) BETWEEN 8 AND 100),
 organization_id uuid NOT NULL UNIQUE REFERENCES providers.organizations(id),
 input jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,operation_key)
);
CREATE FUNCTION providers.immutable_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Organization creations are immutable'; END $$;
CREATE TRIGGER immutable_creation BEFORE UPDATE OR DELETE ON providers.creations FOR EACH ROW EXECUTE FUNCTION providers.immutable_creation();
