ALTER TABLE identity.accounts ADD COLUMN admin_name text NOT NULL DEFAULT '';
ALTER TABLE identity.accounts ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
UPDATE identity.accounts a SET is_admin=true WHERE EXISTS(SELECT 1 FROM identity.grants g WHERE g.account_id=a.id AND g.scope='platform');
CREATE TABLE identity.admin_roles(id uuid PRIMARY KEY,name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),description text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX admin_role_name ON identity.admin_roles(lower(name));
CREATE TABLE identity.admin_role_permissions(role_id uuid REFERENCES identity.admin_roles(id),permission text NOT NULL CHECK(permission IN ('access.manage','customers.read','bookings.read','finance','support','support_assign','moderate','pricing','audit')),PRIMARY KEY(role_id,permission));
CREATE TABLE identity.admin_role_assignments(account_id uuid REFERENCES identity.accounts(id),role_id uuid REFERENCES identity.admin_roles(id),PRIMARY KEY(account_id,role_id));
CREATE TABLE identity.admin_role_grants(account_id uuid NOT NULL,permission text NOT NULL,scope text NOT NULL DEFAULT 'platform' CHECK(scope='platform'),PRIMARY KEY(account_id,permission),FOREIGN KEY(account_id,permission,scope) REFERENCES identity.grants(account_id,permission,scope) ON DELETE CASCADE);
CREATE TABLE identity.admin_requests(actor_id uuid REFERENCES identity.accounts(id),operation text NOT NULL,key text NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,operation,key));
INSERT INTO identity.admin_roles(id,name,description) VALUES
('00000000-0000-4000-8000-000000000101','Super Admin','All currently supported platform administration actions'),
('00000000-0000-4000-8000-000000000102','Operations','Booking and partner operations'),
('00000000-0000-4000-8000-000000000103','Finance','Financial reporting and booking investigation'),
('00000000-0000-4000-8000-000000000104','Support','Customer support and booking investigation'),
('00000000-0000-4000-8000-000000000105','Content Manager','Catalog and help content moderation');
INSERT INTO identity.admin_role_permissions SELECT '00000000-0000-4000-8000-000000000101'::uuid,unnest(ARRAY['access.manage','customers.read','bookings.read','finance','support','support_assign','moderate','pricing','audit']);
INSERT INTO identity.admin_role_permissions SELECT '00000000-0000-4000-8000-000000000102'::uuid,unnest(ARRAY['bookings.read','customers.read','moderate']);
INSERT INTO identity.admin_role_permissions SELECT '00000000-0000-4000-8000-000000000103'::uuid,unnest(ARRAY['finance','bookings.read']);
INSERT INTO identity.admin_role_permissions SELECT '00000000-0000-4000-8000-000000000104'::uuid,unnest(ARRAY['support','customers.read','bookings.read']);
INSERT INTO identity.admin_role_permissions VALUES('00000000-0000-4000-8000-000000000105','moderate');
-- Definitions only. No account receives a role or new privilege automatically.
