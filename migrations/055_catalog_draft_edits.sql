CREATE TABLE catalog.draft_edits (
 listing_id uuid NOT NULL REFERENCES catalog.listings(id),
 input_version integer NOT NULL CHECK(input_version>0),
 version integer NOT NULL CHECK(version=input_version+1),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 input jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(listing_id,input_version)
);
CREATE FUNCTION catalog.immutable_draft_edit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Catalog draft edits are immutable'; END $$;
CREATE TRIGGER immutable_draft_edit BEFORE UPDATE OR DELETE ON catalog.draft_edits FOR EACH ROW EXECUTE FUNCTION catalog.immutable_draft_edit();
