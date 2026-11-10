CREATE SCHEMA buses;
CREATE TABLE buses.records(id uuid PRIMARY KEY,kind text NOT NULL CHECK(kind IN ('operators','routes','services')),code text NOT NULL,content jsonb NOT NULL,status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','planned','disrupted','withdrawn')),version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(kind,code));
CREATE INDEX bus_catalogue_kind_status ON buses.records(kind,status,created_at,id);
CREATE TABLE buses.history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,record_id uuid NOT NULL REFERENCES buses.records(id),actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION buses.immutable_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Bus catalogue history is immutable'; END $$;
CREATE TRIGGER bus_history_immutable BEFORE UPDATE OR DELETE ON buses.history FOR EACH ROW EXECUTE FUNCTION buses.immutable_history();
CREATE TABLE buses.requests(actor_id uuid NOT NULL,operation text NOT NULL,key text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,operation,key));
ALTER TABLE identity.admin_role_permissions DROP CONSTRAINT admin_role_permissions_permission_check;
ALTER TABLE identity.admin_role_permissions ADD CONSTRAINT admin_role_permissions_permission_check CHECK(permission IN ('access.manage','customers.read','bookings.read','finance','support','support_assign','moderate','pricing','audit','flights.read','flights.manage','hotels.read','hotels.manage','hotels.review','buses.read','buses.manage'));
