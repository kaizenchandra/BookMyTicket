CREATE SCHEMA flights;
CREATE TABLE flights.suppliers(
 id uuid PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL,
 airline_codes text[] NOT NULL DEFAULT '{}', environment text NOT NULL CHECK(environment IN ('sandbox','production')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','suspended')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE flights.commercial_rules(
 supplier_id uuid PRIMARY KEY REFERENCES flights.suppliers(id), version integer NOT NULL DEFAULT 1,
 markup_bps integer NOT NULL CHECK(markup_bps BETWEEN 0 AND 10000),
 service_fee_paise bigint NOT NULL CHECK(service_fee_paise BETWEEN 0 AND 100000000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE flights.requests(actor_id uuid NOT NULL, key text NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor_id,key));
ALTER TABLE identity.admin_role_permissions DROP CONSTRAINT admin_role_permissions_permission_check;
ALTER TABLE identity.admin_role_permissions ADD CONSTRAINT admin_role_permissions_permission_check CHECK(permission IN ('access.manage','customers.read','bookings.read','finance','support','support_assign','moderate','pricing','audit','flights.read','flights.manage'));
-- No flight permissions or commercial defaults are granted to existing accounts.
