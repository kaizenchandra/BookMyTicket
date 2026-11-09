CREATE TABLE catalog.submissions (
 listing_id uuid NOT NULL REFERENCES catalog.listings(id),
 input_version integer NOT NULL CHECK(input_version>0),
 version integer NOT NULL CHECK(version=input_version+1),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(listing_id,input_version)
);
CREATE FUNCTION catalog.immutable_submission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Catalog submissions are immutable'; END $$;
CREATE TRIGGER immutable_submission BEFORE UPDATE OR DELETE ON catalog.submissions FOR EACH ROW EXECUTE FUNCTION catalog.immutable_submission();
