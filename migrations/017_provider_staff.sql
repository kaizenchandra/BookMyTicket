CREATE SEQUENCE providers.membership_versions;
ALTER TABLE providers.memberships ADD COLUMN version bigint NOT NULL DEFAULT nextval('providers.membership_versions') CHECK(version>0);
CREATE TABLE providers.invitations (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 email text NOT NULL, role text NOT NULL CHECK(role IN ('editor','viewer')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','revoked')),
 created_by uuid NOT NULL REFERENCES identity.accounts(id), accepted_by uuid REFERENCES identity.accounts(id),
 operation_key text NOT NULL, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
 UNIQUE(organization_id,created_by,operation_key)
);
CREATE INDEX provider_invitation_inbox ON providers.invitations(email,expires_at) WHERE state='pending';
