CREATE TABLE providers.membership_commands (
 organization_id uuid NOT NULL REFERENCES providers.organizations(id),
 account_id uuid NOT NULL REFERENCES identity.accounts(id),
 input_version bigint NOT NULL CHECK(input_version>0),
 actor_id uuid NOT NULL REFERENCES identity.accounts(id),
 action text NOT NULL CHECK(action IN ('editor','viewer','revoke')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,account_id,input_version)
);
CREATE FUNCTION providers.immutable_membership_command() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Membership commands are immutable'; END $$;
CREATE TRIGGER immutable_membership_command BEFORE UPDATE OR DELETE ON providers.membership_commands FOR EACH ROW EXECUTE FUNCTION providers.immutable_membership_command();
