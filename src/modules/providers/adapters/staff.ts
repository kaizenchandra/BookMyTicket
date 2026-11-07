import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { Principal } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { StaffPort, StaffRole } from "../application/staff.ts";
export class PostgresProviderStaff implements StaffPort {
  constructor(private audit: SecurityAudit) {}
  private async owner(tx: Transaction, actor: Principal, org: string) {
    const row = (
      await tx.query(
        "SELECT id FROM providers.organizations WHERE id=$1 FOR UPDATE",
        [org],
      )
    ).rows[0];
    if (
      !row ||
      !(
        await tx.query(
          "SELECT 1 FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 AND role='owner' FOR SHARE",
          [org, actor.id],
        )
      ).rowCount
    )
      throw new AppError(
        "FORBIDDEN",
        "Organization owner access is required.",
        403,
      );
  }
  async inbox(actor: Principal) {
    return (
      await pool.query(
        "SELECT i.id,i.organization_id,o.name AS organization_name,i.role,i.expires_at FROM providers.invitations i JOIN providers.organizations o ON o.id=i.organization_id WHERE i.email=$1 AND i.state='pending' AND i.expires_at>clock_timestamp() ORDER BY i.created_at DESC LIMIT 100",
        [actor.contact],
      )
    ).rows;
  }
  async list(actor: Principal, org: string) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      return {
        members: (
          await tx.query(
            "SELECT account_id,role,version FROM providers.memberships WHERE organization_id=$1 ORDER BY account_id",
            [org],
          )
        ).rows,
        invitations: (
          await tx.query(
            "SELECT id,email,role,CASE WHEN state='pending' AND expires_at<=clock_timestamp() THEN 'expired' ELSE state END AS state,version,expires_at FROM providers.invitations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
            [org],
          )
        ).rows,
      };
    });
  }
  async invite(
    actor: Principal,
    org: string,
    key: string,
    input: { email: string; role: StaffRole },
  ) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      const previous = (
        await tx.query(
          "SELECT * FROM providers.invitations WHERE organization_id=$1 AND created_by=$2 AND operation_key=$3",
          [org, actor.id, key],
        )
      ).rows[0];
      if (previous) {
        if (previous.email !== input.email || previous.role !== input.role)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This request key was already used for a different invitation.",
          );
        return {
          id: previous.id,
          state: previous.state,
          expires_at: previous.expires_at,
        };
      }
      if (input.email === actor.contact)
        throw new AppError(
          "INVALID_INVITATION",
          "You already own this organization.",
          422,
        );
      if (
        (
          await tx.query(
            "SELECT 1 FROM providers.invitations WHERE organization_id=$1 AND email=$2 AND state='pending' AND expires_at>clock_timestamp()",
            [org, input.email],
          )
        ).rowCount
      )
        throw new AppError(
          "CONFLICT",
          "A valid invitation already exists. Revoke it before replacing it.",
        );
      const row = (
        await tx.query(
          "INSERT INTO providers.invitations(id,organization_id,email,role,created_by,operation_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,state,expires_at",
          [randomUUID(), org, input.email, input.role, actor.id, key],
        )
      ).rows[0];
      await this.audit.record(tx, actor.id, "provider.staff.invited", org, {
        invitationId: row.id,
        role: input.role,
      });
      return row;
    });
  }
  async accept(actor: Principal, id: string) {
    return transaction(async (tx) => {
      const scope = (
        await tx.query(
          "SELECT organization_id FROM providers.invitations WHERE id=$1 AND email=$2",
          [id, actor.contact],
        )
      ).rows[0];
      if (!scope) throw new AppError("NOT_FOUND", "Invitation not found.", 404);
      await tx.query(
        "SELECT id FROM providers.organizations WHERE id=$1 FOR UPDATE",
        [scope.organization_id],
      );
      const row = (
        await tx.query(
          "SELECT *,expires_at>clock_timestamp() AS valid FROM providers.invitations WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (row.state === "accepted" && row.accepted_by === actor.id)
        return { id, state: "accepted", organizationId: row.organization_id };
      if (row.state !== "pending" || !row.valid)
        throw new AppError(
          "INVITATION_UNAVAILABLE",
          "Invitation has expired or was revoked.",
          409,
        );
      // A delayed invitation must never replace an existing role or restore a revoked role on replay.
      if (
        (
          await tx.query(
            "SELECT 1 FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
            [row.organization_id, actor.id],
          )
        ).rowCount
      )
        throw new AppError(
          "ALREADY_MEMBER",
          "You already belong to this organization.",
          409,
        );
      await tx.query(
        "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,$3)",
        [row.organization_id, actor.id, row.role],
      );
      await tx.query(
        "UPDATE providers.invitations SET state='accepted',accepted_by=$2,version=version+1 WHERE id=$1",
        [id, actor.id],
      );
      await this.audit.record(
        tx,
        actor.id,
        "provider.staff.accepted",
        row.organization_id,
        { invitationId: id, role: row.role },
      );
      return { id, state: "accepted", organizationId: row.organization_id };
    });
  }
  async revoke(actor: Principal, org: string, id: string, version: number) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      const r = await tx.query(
        "UPDATE providers.invitations SET state='revoked',version=version+1 WHERE id=$1 AND organization_id=$2 AND version=$3 AND state='pending' RETURNING id,state",
        [id, org, version],
      );
      if (!r.rowCount)
        throw new AppError(
          "CONFLICT",
          "Invitation changed. Refresh its status.",
        );
      await this.audit.record(
        tx,
        actor.id,
        "provider.staff.invitation_revoked",
        org,
        { invitationId: id },
      );
      return r.rows[0];
    });
  }
  async member(
    actor: Principal,
    org: string,
    id: string,
    version: number,
    role: StaffRole | "revoke",
  ) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      const row = (
        await tx.query(
          "SELECT role,version FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR UPDATE",
          [org, id],
        )
      ).rows[0];
      if (!row || Number(row.version) !== version)
        throw new AppError(
          "CONFLICT",
          "Membership changed. Refresh its status.",
        );
      if (row.role === "owner")
        throw new AppError(
          "OWNER_PROTECTED",
          "Ownership cannot be changed through staff management.",
          403,
        );
      if (role === "revoke")
        await tx.query(
          "DELETE FROM providers.memberships WHERE organization_id=$1 AND account_id=$2",
          [org, id],
        );
      else
        await tx.query(
          "UPDATE providers.memberships SET role=$3,version=nextval('providers.membership_versions') WHERE organization_id=$1 AND account_id=$2",
          [org, id, role],
        );
      await this.audit.record(
        tx,
        actor.id,
        "provider.staff.membership_changed",
        org,
        { accountId: id, previousRole: row.role, role },
      );
      return { accountId: id, role };
    });
  }
}
