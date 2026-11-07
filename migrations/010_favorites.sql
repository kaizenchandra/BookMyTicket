CREATE TABLE profiles.favorites (
 account_id uuid NOT NULL REFERENCES identity.accounts(id),
 listing_id uuid NOT NULL REFERENCES catalog.listings(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,listing_id)
);
