CREATE TABLE providers.onboarding_saves (
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 input_version integer NOT NULL CHECK(input_version>0),
 version integer NOT NULL CHECK(version=input_version+1),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 state text NOT NULL CHECK(state IN ('draft','changes_requested')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,input_version)
);
CREATE FUNCTION providers.immutable_onboarding_save() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Provider onboarding saves are immutable'; END $$;
CREATE TRIGGER immutable_onboarding_save BEFORE UPDATE OR DELETE ON providers.onboarding_saves FOR EACH ROW EXECUTE FUNCTION providers.immutable_onboarding_save();
