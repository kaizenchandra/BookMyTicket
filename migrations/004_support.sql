CREATE SCHEMA support;
CREATE TABLE support.cases(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES identity.accounts(id),subject text NOT NULL,category text NOT NULL,state text NOT NULL DEFAULT 'open',assigned_to uuid REFERENCES identity.accounts(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE support.messages(id uuid PRIMARY KEY,case_id uuid NOT NULL REFERENCES support.cases(id),author_id uuid NOT NULL REFERENCES identity.accounts(id),audience text NOT NULL CHECK(audience IN ('customer','internal')),body text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
