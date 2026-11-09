CREATE INDEX notification_owner_unread ON notifications.messages(owner_id) WHERE read_at IS NULL;
