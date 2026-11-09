CREATE TABLE profiles.venue_favorites (
 account_id uuid NOT NULL REFERENCES identity.accounts(id),
 venue_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,venue_id)
);
