CREATE TABLE reporting.attendee_exports (
 id uuid PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 occurrence_id uuid NOT NULL REFERENCES inventory.occurrences(id),
 form_id uuid NOT NULL REFERENCES events.registration_forms(id),
 fields jsonb NOT NULL,
 purpose text NOT NULL,
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','ready','failed','expired')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 error_code text,
 artifact text,
 row_count integer,
 created_at timestamptz NOT NULL DEFAULT now(),
 generated_at timestamptz,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 UNIQUE(actor_id,operation_key),
 CHECK((state='ready')=(artifact IS NOT NULL))
);
CREATE INDEX attendee_export_queue ON reporting.attendee_exports(next_attempt_at,created_at) WHERE state='queued';
CREATE INDEX attendee_export_actor ON reporting.attendee_exports(actor_id,occurrence_id,created_at DESC);
CREATE INDEX registration_form_orders ON bookings.registrations(form_id,order_id);
