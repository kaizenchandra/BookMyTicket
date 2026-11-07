ALTER TABLE payments.webhook_events ADD COLUMN lease_token uuid;
ALTER TABLE payments.webhook_events ADD COLUMN lease_until timestamptz;
ALTER TABLE payments.webhook_events ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payments.webhook_events ADD COLUMN last_error_code text;
CREATE FUNCTION reporting.record_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO reporting.audit(action,target,details) VALUES(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME||'.'||TG_OP,NEW.id::text,jsonb_build_object('state',NEW.state,'version',NEW.version)); RETURN NEW;
END $$;
CREATE TRIGGER audit_provider AFTER INSERT OR UPDATE ON providers.organizations FOR EACH ROW EXECUTE FUNCTION reporting.record_change();
CREATE TRIGGER audit_listing AFTER INSERT OR UPDATE ON catalog.listings FOR EACH ROW EXECUTE FUNCTION reporting.record_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON reporting.audit FOR EACH ROW EXECUTE FUNCTION finance.deny_mutation();
