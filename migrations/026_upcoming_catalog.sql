-- Rebuildable discovery projection; Inventory remains authoritative for admission and sales.
CREATE TABLE catalog.session_projection (
 occurrence_id uuid PRIMARY KEY,
 listing_id uuid NOT NULL REFERENCES catalog.listings(id),
 starts_at timestamptz NOT NULL,
 time_zone text NOT NULL,
 venue_name text NOT NULL,
 state text NOT NULL
);
CREATE INDEX catalog_next_session ON catalog.session_projection(listing_id,starts_at) WHERE state='open';
INSERT INTO catalog.session_projection SELECT id,listing_id,starts_at,time_zone,venue_name,state FROM inventory.occurrences;
