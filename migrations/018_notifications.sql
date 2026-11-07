CREATE TABLE reporting.deliveries (
 event_id uuid NOT NULL REFERENCES reporting.outbox(id), consumer text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','done','dead')),
 attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz, last_error_code text,
 PRIMARY KEY(event_id,consumer)
);
CREATE INDEX durable_delivery_work ON reporting.deliveries(consumer,available_at,event_id) WHERE state='pending';
CREATE SCHEMA notifications;
CREATE TABLE notifications.messages (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES identity.accounts(id),
 event_id uuid NOT NULL UNIQUE REFERENCES reporting.outbox(id),
 template text NOT NULL, template_version integer NOT NULL, title text NOT NULL, body text NOT NULL,
 href text NOT NULL, occurred_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX notification_owner_page ON notifications.messages(owner_id,created_at DESC,id DESC);
