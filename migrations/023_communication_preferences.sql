CREATE TABLE profiles.communication_preferences (
 account_id uuid PRIMARY KEY REFERENCES identity.accounts(id),
 language text NOT NULL DEFAULT 'en' CHECK(language IN ('en','hi','kn','ta','te','mr','bn','ml','gu','pa')),
 marketing_email boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE profiles.marketing_consent_history (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 account_id uuid NOT NULL REFERENCES identity.accounts(id),
 purpose text NOT NULL CHECK(purpose='marketing_email'),
 policy_version integer NOT NULL CHECK(policy_version=1),
 granted boolean NOT NULL,
 preference_version integer NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(account_id,preference_version)
);
