ALTER TABLE venues.venues
 ADD COLUMN contact_phone text NOT NULL DEFAULT '',
 ADD COLUMN contact_email text NOT NULL DEFAULT '',
 ADD COLUMN contact_public boolean NOT NULL DEFAULT false,
 ADD COLUMN contact_version integer NOT NULL DEFAULT 1 CHECK (contact_version > 0),
 ADD CONSTRAINT venue_public_contact_present CHECK (NOT contact_public OR contact_phone <> '' OR contact_email <> '');
