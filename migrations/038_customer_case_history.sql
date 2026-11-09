CREATE INDEX support_customer_history ON support.cases(owner_id,created_at DESC,id DESC);
