ALTER TABLE identity.sessions ADD COLUMN mfa_verified_at timestamptz;
CREATE TABLE identity.mfa (
 account_id uuid PRIMARY KEY REFERENCES identity.accounts(id),
 secret_ciphertext text,
 last_counter bigint NOT NULL DEFAULT -1,
 pending_id uuid,
 pending_session_hash text,
 pending_ciphertext text,
 pending_expires_at timestamptz,
 failures integer NOT NULL DEFAULT 0 CHECK(failures>=0),
 window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE identity.mfa_recovery_codes (
 account_id uuid NOT NULL REFERENCES identity.mfa(account_id),
 code_hash text NOT NULL,
 used_at timestamptz,
 PRIMARY KEY(account_id,code_hash)
);
CREATE FUNCTION identity.audit_mfa_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO reporting.audit(actor_id,action,target,details) VALUES(NEW.account_id,'identity.mfa.changed',NEW.account_id::text,jsonb_build_object('enrolled',NEW.secret_ciphertext IS NOT NULL,'pending',NEW.pending_id IS NOT NULL,'failures',NEW.failures)); RETURN NEW;
END $$;
CREATE TRIGGER audit_mfa AFTER INSERT OR UPDATE ON identity.mfa FOR EACH ROW EXECUTE FUNCTION identity.audit_mfa_change();
