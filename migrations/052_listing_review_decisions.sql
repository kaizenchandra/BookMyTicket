CREATE TABLE catalog.review_decisions (
 listing_id uuid NOT NULL REFERENCES catalog.listings(id),
 input_version integer NOT NULL CHECK(input_version>0),
 version integer NOT NULL CHECK(version=input_version+1),
 reviewer_id uuid NOT NULL REFERENCES identity.accounts(id),
 decision text NOT NULL CHECK(decision IN ('published','changes_requested')),
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 5 AND 2000),
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(listing_id,input_version)
);
CREATE FUNCTION catalog.immutable_review_decision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Listing review decisions are immutable'; END $$;
CREATE TRIGGER immutable_review_decision BEFORE UPDATE OR DELETE ON catalog.review_decisions FOR EACH ROW EXECUTE FUNCTION catalog.immutable_review_decision();
