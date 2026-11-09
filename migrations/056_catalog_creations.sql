CREATE TABLE catalog.creations (
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 operation_key text NOT NULL CHECK(char_length(operation_key) BETWEEN 8 AND 100),
 listing_id uuid NOT NULL UNIQUE REFERENCES catalog.listings(id),
 input jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(actor_id,organization_id,operation_key)
);
CREATE FUNCTION catalog.immutable_creation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Catalog creations are immutable'; END $$;
CREATE TRIGGER immutable_creation BEFORE UPDATE OR DELETE ON catalog.creations FOR EACH ROW EXECUTE FUNCTION catalog.immutable_creation();
