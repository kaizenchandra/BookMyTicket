CREATE TABLE profiles.saved_attendees (
 account_id uuid PRIMARY KEY REFERENCES identity.accounts(id),
 ciphertext text,
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE profiles.attendee_consent_history (
 account_id uuid NOT NULL REFERENCES identity.accounts(id),
 preference_version integer NOT NULL,
 purpose text NOT NULL CHECK(purpose='saved_attendees'),
 policy_version integer NOT NULL CHECK(policy_version=1),
 granted boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(account_id,preference_version)
);
