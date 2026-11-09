-- Immutable audit search; no historical values are rewritten or inferred.
CREATE INDEX audit_actor_page ON reporting.audit(actor_id,id DESC);
CREATE INDEX audit_action_page ON reporting.audit(action,id DESC);
CREATE INDEX audit_target_page ON reporting.audit(target,id DESC);
CREATE INDEX audit_time_page ON reporting.audit(created_at,id DESC);
