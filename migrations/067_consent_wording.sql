ALTER TABLE profiles.marketing_consent_history ADD COLUMN policy_text text CHECK(policy_text IS NULL OR char_length(policy_text) BETWEEN 1 AND 3000);
ALTER TABLE profiles.attendee_consent_history ADD COLUMN policy_text text CHECK(policy_text IS NULL OR char_length(policy_text) BETWEEN 1 AND 3000);
-- Historical rows deliberately remain NULL: their displayed wording was not retained.
