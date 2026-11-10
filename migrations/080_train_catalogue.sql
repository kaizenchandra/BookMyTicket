CREATE SCHEMA trains;
CREATE TABLE trains.records(id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('stations','routes','services')),code text NOT NULL,content jsonb NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','planned','disrupted','withdrawn')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,code));
CREATE INDEX train_catalogue_kind_status ON trains.records(kind,status,created_at,id);
CREATE TABLE trains.history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,record_id uuid NOT NULL REFERENCES trains.records(id),actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION trains.immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Train catalogue history is immutable'; END $$;
CREATE TRIGGER train_history_immutable BEFORE UPDATE OR DELETE ON trains.history FOR EACH ROW EXECUTE FUNCTION trains.immutable_history();
CREATE TABLE trains.requests(actor_id uuid NOT NULL,operation text NOT NULL,key text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,operation,key));
ALTER TABLE identity.admin_role_permissions DROP CONSTRAINT admin_role_permissions_permission_check;
ALTER TABLE identity.admin_role_permissions ADD CONSTRAINT admin_role_permissions_permission_check CHECK(permission IN ('access.manage','customers.read','bookings.read','finance','support','support_assign','moderate','pricing','audit','flights.read','flights.manage','hotels.read','hotels.manage','hotels.review','buses.read','buses.manage','trains.read','trains.manage'));

CREATE UNIQUE INDEX train_station_code ON trains.records((content->>'stationCode')) WHERE kind='stations';
