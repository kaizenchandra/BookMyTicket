ALTER TABLE payments.attempts ADD COLUMN method text;
ALTER TABLE payments.attempts ADD COLUMN error_code text;
ALTER TABLE payments.attempts ADD COLUMN error_reason text;
ALTER TABLE payments.attempts ADD COLUMN amount_refunded_paise bigint CHECK(amount_refunded_paise>=0 AND amount_refunded_paise<=amount_paise);
ALTER TABLE payments.attempt_observations ADD COLUMN method text;
ALTER TABLE payments.attempt_observations ADD COLUMN error_code text;
ALTER TABLE payments.attempt_observations ADD COLUMN error_reason text;
ALTER TABLE payments.attempt_observations ADD COLUMN amount_refunded_paise bigint;
CREATE OR REPLACE FUNCTION payments.record_attempt_observation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO payments.attempt_observations(attempt_id,provider_payment_id,order_id,state,amount_paise,currency,method,error_code,error_reason,amount_refunded_paise)
  VALUES(NEW.timeline_id,NEW.provider_payment_id,NEW.order_id,NEW.state,NEW.amount_paise,NEW.currency,NEW.method,NEW.error_code,NEW.error_reason,NEW.amount_refunded_paise);
 ELSIF ROW(OLD.state,OLD.method,OLD.error_code,OLD.error_reason,OLD.amount_refunded_paise) IS DISTINCT FROM ROW(NEW.state,NEW.method,NEW.error_code,NEW.error_reason,NEW.amount_refunded_paise) THEN
  INSERT INTO payments.attempt_observations(attempt_id,provider_payment_id,order_id,previous_state,state,amount_paise,currency,method,error_code,error_reason,amount_refunded_paise)
  VALUES(NEW.timeline_id,NEW.provider_payment_id,NEW.order_id,OLD.state,NEW.state,NEW.amount_paise,NEW.currency,NEW.method,NEW.error_code,NEW.error_reason,NEW.amount_refunded_paise);
 END IF;
 RETURN NEW;
END $$;
CREATE INDEX payment_admin_method_state ON payments.attempts(method,state,observed_at,timeline_id);
