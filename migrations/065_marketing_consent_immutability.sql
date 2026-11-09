CREATE FUNCTION profiles.immutable_marketing_consent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Marketing consent history is immutable'; END $$;
CREATE TRIGGER immutable_marketing_consent BEFORE UPDATE OR DELETE ON profiles.marketing_consent_history FOR EACH ROW EXECUTE FUNCTION profiles.immutable_marketing_consent();
