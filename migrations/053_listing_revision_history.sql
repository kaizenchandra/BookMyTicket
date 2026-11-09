CREATE INDEX listing_revision_history_order ON catalog.revisions(listing_id,id DESC);
CREATE FUNCTION catalog.immutable_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Catalog revisions are immutable'; END $$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON catalog.revisions FOR EACH ROW EXECUTE FUNCTION catalog.immutable_revision();
