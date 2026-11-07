CREATE SCHEMA pricing;
CREATE TABLE pricing.policies (
 id uuid PRIMARY KEY,
 label text NOT NULL CHECK(length(label) BETWEEN 2 AND 150),
 configuration jsonb NOT NULL,
 approved_by uuid NOT NULL REFERENCES identity.accounts(id),
 approval_reason text NOT NULL CHECK(length(approval_reason)>=5),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE pricing.assignments (
 occurrence_id uuid PRIMARY KEY REFERENCES inventory.occurrences(id),
 policy_id uuid NOT NULL REFERENCES pricing.policies(id),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_by uuid NOT NULL REFERENCES identity.accounts(id),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE pricing.quotes (
 id uuid PRIMARY KEY,
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 reservation_id uuid NOT NULL REFERENCES inventory.reservations(id),
 policy_id uuid NOT NULL REFERENCES pricing.policies(id),
 amount_paise integer NOT NULL CHECK(amount_paise>=0),
 currency text NOT NULL CHECK(currency='INR'),
 snapshot jsonb NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(reservation_id,policy_id)
);
CREATE INDEX quotes_owner ON pricing.quotes(owner_id,id);
CREATE TRIGGER immutable_policies BEFORE UPDATE OR DELETE ON pricing.policies FOR EACH ROW EXECUTE FUNCTION finance.deny_mutation();
CREATE TRIGGER immutable_quotes BEFORE UPDATE OR DELETE ON pricing.quotes FOR EACH ROW EXECUTE FUNCTION finance.deny_mutation();
ALTER TABLE bookings.orders ADD COLUMN quote_id uuid REFERENCES pricing.quotes(id);
ALTER TABLE bookings.orders ADD COLUMN accepted_at timestamptz;
CREATE TABLE bookings.placement_commands (
 owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 operation_key text NOT NULL,
 fingerprint text NOT NULL,
 order_id uuid NOT NULL REFERENCES bookings.orders(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(owner_id,operation_key)
);
CREATE FUNCTION bookings.protect_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF ROW(NEW.owner_id,NEW.reservation_id,NEW.amount_paise,NEW.currency,NEW.policy_version,NEW.snapshot,NEW.quote_id,NEW.accepted_at)
 IS DISTINCT FROM ROW(OLD.owner_id,OLD.reservation_id,OLD.amount_paise,OLD.currency,OLD.policy_version,OLD.snapshot,OLD.quote_id,OLD.accepted_at)
 THEN RAISE EXCEPTION 'Accepted commercial snapshot is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_order_snapshot BEFORE UPDATE ON bookings.orders FOR EACH ROW EXECUTE FUNCTION bookings.protect_snapshot();
CREATE FUNCTION pricing.audit_policy() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='policies' THEN
  INSERT INTO reporting.audit(actor_id,action,target,details) VALUES(NEW.approved_by,'pricing.policy.approved',NEW.id::text,jsonb_build_object('label',NEW.label,'reason',NEW.approval_reason));
 ELSE
  INSERT INTO reporting.audit(actor_id,action,target,details) VALUES(NEW.updated_by,'pricing.policy.assigned',NEW.occurrence_id::text,jsonb_build_object('policyId',NEW.policy_id,'version',NEW.version));
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER audit_policy AFTER INSERT ON pricing.policies FOR EACH ROW EXECUTE FUNCTION pricing.audit_policy();
CREATE TRIGGER audit_policy_assignment AFTER INSERT OR UPDATE ON pricing.assignments FOR EACH ROW EXECUTE FUNCTION pricing.audit_policy();
