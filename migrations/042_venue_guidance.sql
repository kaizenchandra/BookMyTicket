ALTER TABLE venues.venues
 ADD COLUMN transport_guidance text NOT NULL DEFAULT '',
 ADD COLUMN parking_guidance text NOT NULL DEFAULT '',
 ADD COLUMN entry_policies text NOT NULL DEFAULT '',
 ADD COLUMN guidance_version integer NOT NULL DEFAULT 1 CHECK (guidance_version > 0);
