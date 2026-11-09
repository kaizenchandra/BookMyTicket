-- Rebuildable public discovery data; inventory remains sale authority.
ALTER TABLE catalog.session_projection ADD COLUMN venue_id uuid;
UPDATE catalog.session_projection p SET venue_id=(o.venue_snapshot->>'venueId')::uuid
FROM inventory.occurrences o WHERE p.occurrence_id=o.id
AND o.venue_snapshot->>'venueId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
CREATE INDEX catalog_venue_sessions ON catalog.session_projection(venue_id,starts_at,occurrence_id);
