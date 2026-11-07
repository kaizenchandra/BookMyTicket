ALTER TABLE support.cases ADD COLUMN priority text NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'));
ALTER TABLE support.cases ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE support.cases ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE support.cases ADD CONSTRAINT case_lifecycle CHECK(state IN ('open','in_progress','escalated','resolved'));
CREATE INDEX support_queue ON support.cases(state,priority,created_at DESC,id);
