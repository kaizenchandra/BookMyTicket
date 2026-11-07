CREATE SCHEMA cinema;
CREATE SCHEMA sports;
CREATE TABLE cinema.movies(listing_id uuid PRIMARY KEY REFERENCES catalog.listings(id),organization_id uuid NOT NULL REFERENCES providers.organizations(id),details jsonb NOT NULL,version integer NOT NULL DEFAULT 1);
CREATE TABLE sports.fixtures(listing_id uuid PRIMARY KEY REFERENCES catalog.listings(id),organization_id uuid NOT NULL REFERENCES providers.organizations(id),details jsonb NOT NULL,version integer NOT NULL DEFAULT 1);
CREATE TABLE catalog.category_commands(owner_id uuid NOT NULL,organization_id uuid NOT NULL,operation_key text NOT NULL,fingerprint text NOT NULL,listing_id uuid NOT NULL REFERENCES catalog.listings(id),PRIMARY KEY(owner_id,organization_id,operation_key));
ALTER TABLE inventory.occurrences ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
