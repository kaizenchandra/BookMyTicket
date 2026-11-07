ALTER TABLE payments.provider_orders ADD COLUMN checked_at timestamptz;
ALTER TABLE payments.provider_orders ADD COLUMN available_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE payments.provider_orders ADD COLUMN lease_token uuid;
ALTER TABLE payments.provider_orders ADD COLUMN lease_until timestamptz;
ALTER TABLE payments.provider_orders ADD COLUMN failures integer NOT NULL DEFAULT 0;
ALTER TABLE payments.provider_orders ADD COLUMN last_error_code text;
ALTER TABLE payments.provider_orders ADD COLUMN review_required boolean NOT NULL DEFAULT false;
CREATE INDEX payment_reconcile_due ON payments.provider_orders(available_at) WHERE NOT review_required;
CREATE TABLE payments.attempts (
 provider_payment_id text PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES payments.provider_orders(order_id),
 amount_paise integer NOT NULL CHECK(amount_paise>0),
 currency text NOT NULL CHECK(currency='INR'),
 state text NOT NULL CHECK(state IN ('created','authorized','captured','refunded','failed')),
 observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_attempt_order ON payments.attempts(order_id);
ALTER TABLE payments.provider_orders ADD COLUMN retry_watermark text;
