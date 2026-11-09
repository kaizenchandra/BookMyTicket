CREATE FUNCTION profiles.immutable_attendee_consent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Attendee consent history is immutable'; END $$;
CREATE TRIGGER immutable_attendee_consent BEFORE UPDATE OR DELETE ON profiles.attendee_consent_history FOR EACH ROW EXECUTE FUNCTION profiles.immutable_attendee_consent();
