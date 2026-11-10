ALTER TABLE payments.attempts ADD COLUMN timeline_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX attempt_timeline_identity ON payments.attempts(timeline_id);
CREATE TABLE payments.attempt_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 attempt_id uuid NOT NULL,
 provider_payment_id text NOT NULL REFERENCES payments.attempts(provider_payment_id),
 order_id uuid NOT NULL REFERENCES payments.provider_orders(order_id),
 previous_state text CHECK(previous_state IN ('created','authorized','captured','refunded','failed')),
 state text NOT NULL CHECK(state IN ('created','authorized','captured','refunded','failed')),
 amount_paise integer NOT NULL CHECK(amount_paise>0), currency text NOT NULL CHECK(currency='INR'),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX attempt_observation_page ON payments.attempt_observations(order_id,recorded_at DESC,id DESC);
CREATE FUNCTION payments.record_attempt_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO payments.attempt_observations(attempt_id,provider_payment_id,order_id,state,amount_paise,currency)
  VALUES(NEW.timeline_id,NEW.provider_payment_id,NEW.order_id,NEW.state,NEW.amount_paise,NEW.currency);
 ELSIF OLD.state IS DISTINCT FROM NEW.state THEN
  INSERT INTO payments.attempt_observations(attempt_id,provider_payment_id,order_id,previous_state,state,amount_paise,currency)
  VALUES(NEW.timeline_id,NEW.provider_payment_id,NEW.order_id,OLD.state,NEW.state,NEW.amount_paise,NEW.currency);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER record_attempt_observation AFTER INSERT OR UPDATE ON payments.attempts FOR EACH ROW EXECUTE FUNCTION payments.record_attempt_observation();
CREATE FUNCTION payments.immutable_attempt_observation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Payment attempt observations are immutable'; END $$;
CREATE TRIGGER immutable_attempt_observation BEFORE UPDATE OR DELETE ON payments.attempt_observations FOR EACH ROW EXECUTE FUNCTION payments.immutable_attempt_observation();
-- No historical transitions are backfilled from current attempt state.
