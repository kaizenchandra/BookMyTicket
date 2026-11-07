CREATE SCHEMA venues;
CREATE TABLE venues.venues (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES providers.organizations(id), name text NOT NULL, address text NOT NULL, city text NOT NULL, time_zone text NOT NULL, amenities text NOT NULL, accessibility text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE venues.spaces (
 id uuid PRIMARY KEY, venue_id uuid NOT NULL REFERENCES venues.venues(id), name text NOT NULL, kind text NOT NULL CHECK(kind IN ('screen','auditorium','stadium','hall')), physical_capacity integer NOT NULL CHECK(physical_capacity>0), turnaround_minutes integer NOT NULL CHECK(turnaround_minutes BETWEEN 0 AND 1440), version integer NOT NULL DEFAULT 1, UNIQUE(venue_id,name)
);
CREATE TABLE venues.plans (
 id uuid PRIMARY KEY, space_id uuid NOT NULL REFERENCES venues.spaces(id), version integer NOT NULL CHECK(version>0), label text NOT NULL, configuration jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(space_id,version)
);
CREATE FUNCTION venues.immutable_plan() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Seating plan versions are immutable'; END $$;
CREATE TRIGGER immutable_plan BEFORE UPDATE OR DELETE ON venues.plans FOR EACH ROW EXECUTE FUNCTION venues.immutable_plan();
ALTER TABLE inventory.occurrences ADD COLUMN space_id uuid REFERENCES venues.spaces(id);
ALTER TABLE inventory.occurrences ADD COLUMN plan_id uuid REFERENCES venues.plans(id);
ALTER TABLE inventory.occurrences ADD COLUMN venue_snapshot jsonb;
ALTER TABLE inventory.occurrences ADD COLUMN turnaround_minutes integer NOT NULL DEFAULT 0 CHECK(turnaround_minutes>=0);
CREATE INDEX space_schedule ON inventory.occurrences(space_id,starts_at,ends_at) WHERE state<>'cancelled';
CREATE TABLE inventory.schedule_commands(actor_id uuid NOT NULL REFERENCES identity.accounts(id),operation_key text NOT NULL,fingerprint text NOT NULL,occurrence_id uuid NOT NULL REFERENCES inventory.occurrences(id),PRIMARY KEY(actor_id,operation_key));
