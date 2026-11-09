CREATE TABLE providers.invitation_revocations (
 invitation_id uuid PRIMARY KEY REFERENCES providers.invitations(id),
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 input_version integer NOT NULL CHECK(input_version>0 AND input_version<2147483647),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION providers.immutable_invitation_revocation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Invitation revocations are immutable'; END $$;
CREATE TRIGGER immutable_invitation_revocation BEFORE UPDATE OR DELETE ON providers.invitation_revocations FOR EACH ROW EXECUTE FUNCTION providers.immutable_invitation_revocation();
