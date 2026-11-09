CREATE INDEX support_queue_page ON support.cases(created_at DESC,id DESC);
CREATE INDEX support_assignee_page ON support.cases(assigned_to,created_at DESC,id DESC);
