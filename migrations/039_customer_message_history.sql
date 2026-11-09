CREATE INDEX support_customer_messages_page ON support.messages(case_id,created_at DESC,id DESC) WHERE audience='customer';
