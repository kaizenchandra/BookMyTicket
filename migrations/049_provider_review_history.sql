CREATE TABLE providers.review_decisions (
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 version integer NOT NULL,
 input_version integer NOT NULL,
 reviewer_id uuid NOT NULL REFERENCES identity.accounts(id),
 organization_name text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('approved','changes_requested','rejected')),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 5 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,version),
 CHECK(version=input_version+1)
);
CREATE FUNCTION providers.immutable_review_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Provider review decisions are immutable'; END $$;
CREATE TRIGGER immutable_review_decision BEFORE UPDATE OR DELETE ON providers.review_decisions FOR EACH ROW EXECUTE FUNCTION providers.immutable_review_decision();
