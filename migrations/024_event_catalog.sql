CREATE TABLE events.catalog_details (
 listing_id uuid PRIMARY KEY REFERENCES catalog.listings(id),
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 details jsonb NOT NULL,
 version integer NOT NULL DEFAULT 1
);
CREATE INDEX event_catalog_organization ON events.catalog_details(organization_id);
