CREATE SCHEMA bookings;
CREATE SCHEMA ticketing;
CREATE SCHEMA finance;
CREATE TABLE catalog.revisions(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, listing_id uuid NOT NULL REFERENCES catalog.listings(id), actor_id uuid, version integer NOT NULL, snapshot jsonb NOT NULL, reason text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE bookings.orders (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES identity.accounts(id), reservation_id uuid NOT NULL UNIQUE REFERENCES inventory.reservations(id), amount_paise integer NOT NULL CHECK(amount_paise>=0), currency text NOT NULL CHECK(currency='INR'), policy_version text NOT NULL, state text NOT NULL DEFAULT 'pending_payment' CHECK(state IN ('pending_payment','confirmed','refund_required','cancelled')), snapshot jsonb NOT NULL, confirmed_payment_id text UNIQUE, created_at timestamptz NOT NULL DEFAULT now(), confirmed_at timestamptz
);
CREATE TABLE payments.provider_orders (
 order_id uuid PRIMARY KEY REFERENCES bookings.orders(id), provider_id text UNIQUE, amount_paise integer NOT NULL CHECK(amount_paise>0), state text NOT NULL CHECK(state IN ('creating','ready','unknown','failed')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments.captures (
 provider_payment_id text PRIMARY KEY, order_id uuid NOT NULL REFERENCES bookings.orders(id), amount_paise integer NOT NULL CHECK(amount_paise>0), currency text NOT NULL CHECK(currency='INR'), captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE payments.recovery (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bookings.orders(id), provider_payment_id text NOT NULL UNIQUE, reason text NOT NULL, amount_paise integer NOT NULL CHECK(amount_paise>0), state text NOT NULL DEFAULT 'review_required', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ticketing.tickets (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES bookings.orders(id), owner_id uuid NOT NULL REFERENCES identity.accounts(id), occurrence_id uuid NOT NULL REFERENCES inventory.occurrences(id), resource_id text NOT NULL, ordinal integer NOT NULL, token_hash text UNIQUE NOT NULL, token_ciphertext text NOT NULL, state text NOT NULL DEFAULT 'valid' CHECK(state IN ('valid','revoked','replaced','expired')), remaining integer NOT NULL DEFAULT 1 CHECK(remaining>=0), UNIQUE(order_id,occurrence_id,resource_id,ordinal)
);
CREATE TABLE ticketing.admissions (
 id uuid PRIMARY KEY, ticket_id uuid REFERENCES ticketing.tickets(id), actor_id uuid NOT NULL REFERENCES identity.accounts(id), occurrence_id uuid NOT NULL, gate text NOT NULL, operation_key text NOT NULL, fingerprint text NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,operation_key)
);
CREATE TABLE finance.journals(id uuid PRIMARY KEY,event_id text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE finance.lines(journal_id uuid NOT NULL REFERENCES finance.journals(id),account text NOT NULL,amount_paise bigint NOT NULL CHECK(amount_paise<>0),currency text NOT NULL CHECK(currency='INR'));
CREATE FUNCTION finance.assert_balanced() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF (SELECT COALESCE(sum(amount_paise),0) FROM finance.lines WHERE journal_id=NEW.journal_id)<>0 THEN RAISE EXCEPTION 'Unbalanced journal'; END IF; RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER balanced_journal AFTER INSERT ON finance.lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finance.assert_balanced();
CREATE FUNCTION finance.deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Posted financial records are immutable'; END $$;
CREATE TRIGGER immutable_lines BEFORE UPDATE OR DELETE ON finance.lines FOR EACH ROW EXECUTE FUNCTION finance.deny_mutation();
CREATE TRIGGER immutable_journals BEFORE UPDATE OR DELETE ON finance.journals FOR EACH ROW EXECUTE FUNCTION finance.deny_mutation();
