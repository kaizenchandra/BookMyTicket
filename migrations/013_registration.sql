CREATE SCHEMA events;
CREATE TABLE events.registration_forms (
 id uuid PRIMARY KEY, occurrence_id uuid NOT NULL REFERENCES inventory.occurrences(id), version integer NOT NULL CHECK(version>0), definition jsonb NOT NULL, created_by uuid NOT NULL REFERENCES identity.accounts(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(occurrence_id,version)
);
CREATE TABLE events.form_assignments (
 occurrence_id uuid PRIMARY KEY REFERENCES inventory.occurrences(id), form_id uuid NOT NULL REFERENCES events.registration_forms(id), version integer NOT NULL CHECK(version>0)
);
CREATE FUNCTION events.immutable_form() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Registration form versions are immutable'; END $$;
CREATE TRIGGER immutable_form BEFORE UPDATE OR DELETE ON events.registration_forms FOR EACH ROW EXECUTE FUNCTION events.immutable_form();
CREATE TABLE bookings.registrations (
 order_id uuid PRIMARY KEY REFERENCES bookings.orders(id), owner_id uuid NOT NULL REFERENCES identity.accounts(id), form_id uuid NOT NULL REFERENCES events.registration_forms(id), form_snapshot jsonb NOT NULL, answers_ciphertext text NOT NULL, input_digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION bookings.immutable_registration() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Accepted registrations require an explicit correction or retention workflow'; END $$;
CREATE TRIGGER immutable_registration BEFORE UPDATE OR DELETE ON bookings.registrations FOR EACH ROW EXECUTE FUNCTION bookings.immutable_registration();
