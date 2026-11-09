CREATE TABLE providers.submissions (
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 input_version integer NOT NULL CHECK(input_version>0),
 version integer NOT NULL CHECK(version=input_version+1),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,input_version)
);
CREATE FUNCTION providers.immutable_submission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Provider submissions are immutable'; END $$;
CREATE TRIGGER immutable_submission BEFORE UPDATE OR DELETE ON providers.submissions FOR EACH ROW EXECUTE FUNCTION providers.immutable_submission();
