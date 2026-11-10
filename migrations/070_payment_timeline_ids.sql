ALTER TABLE payments.captures ADD COLUMN timeline_id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX capture_timeline_identity ON payments.captures(timeline_id);
CREATE INDEX capture_timeline_page ON payments.captures(order_id,captured_at DESC,timeline_id DESC);
CREATE INDEX recovery_timeline_page ON payments.recovery(order_id,created_at DESC,id DESC);
