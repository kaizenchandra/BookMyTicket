CREATE TABLE providers.onboarding_details (
 organization_id uuid PRIMARY KEY REFERENCES providers.organizations(id),
 legal_name text NOT NULL DEFAULT '',
 business_address text NOT NULL DEFAULT '',
 contact_name text NOT NULL DEFAULT '',
 contact_email text NOT NULL DEFAULT '',
 contact_phone text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now()
);
