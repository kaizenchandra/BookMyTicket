CREATE TABLE reporting.dashboard_snapshots (
 id uuid PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 definition_version text NOT NULL,
 filters jsonb NOT NULL,
 report jsonb NOT NULL
);
CREATE INDEX dashboard_snapshot_history ON reporting.dashboard_snapshots(created_at DESC,id DESC);
CREATE FUNCTION reporting.protect_dashboard_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'Historical dashboard snapshots are immutable';
END $$;
CREATE TRIGGER dashboard_snapshot_immutable BEFORE UPDATE ON reporting.dashboard_snapshots FOR EACH ROW EXECUTE FUNCTION reporting.protect_dashboard_snapshot();
