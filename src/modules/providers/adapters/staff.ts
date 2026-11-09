import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { Principal } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  InvitationPageFilter,
  StaffPort,
  StaffPageFilter,
  StaffRole,
} from "../application/staff.ts";
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
  async inbox(actor: Principal, filter: InvitationPageFilter = {}) {
    const rows = (
      await pool.query(
        `SELECT i.id,i.organization_id,o.name AS organization_name,i.role,i.expires_at,
       to_char(i.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
       FROM providers.invitations i JOIN providers.organizations o ON o.id=i.organization_id
       WHERE i.email=$1 AND i.state='pending' AND i.expires_at>clock_timestamp()
       AND ($2::timestamptz IS NULL OR (i.created_at,i.id)<($2::timestamptz,$3::uuid))
       ORDER BY i.created_at DESC,i.id DESC LIMIT 21`,
        [actor.contact, filter.afterCreatedAt ?? null, filter.afterId ?? null],
      )
    ).rows;
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > 20
          ? { afterCreatedAt: last.createdAt, afterId: last.id }
          : null,
    };
  }
  async list(actor: Principal, org: string, filter: StaffPageFilter = {}) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      const rows = (
        await tx.query(
          `SELECT id,email,role,CASE WHEN state='pending' AND expires_at<=statement_timestamp() THEN 'expired' ELSE state END AS state,version,expires_at,
         to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
         FROM providers.invitations WHERE organization_id=$1
         AND ($4::text IS NULL OR (CASE WHEN state='pending' AND expires_at<=statement_timestamp() THEN 'expired' ELSE state END)=$4)
         AND ($2::timestamptz IS NULL OR (created_at,id)<($2::timestamptz,$3::uuid))
         ORDER BY created_at DESC,id DESC LIMIT 21`,
          [
            org,
            filter.afterCreatedAt ?? null,
            filter.afterId ?? null,
            filter.invitationState ?? null,
          ],
        )
      ).rows;
      const invitations = rows.slice(0, 20),
        last = invitations.at(-1);
      const memberRows = (
        await tx.query(
          "SELECT account_id,role,version FROM providers.memberships WHERE organization_id=$1 AND ($2::uuid IS NULL OR account_id>$2) AND ($3::text IS NULL OR role=$3) ORDER BY account_id LIMIT 21",
          [org, filter.afterMemberId ?? null, filter.memberRole ?? null],
        )
      ).rows;
      const members = memberRows.slice(0, 20);
      return {
        members,
        nextMemberCursor:
          memberRows.length > 20
            ? { afterMemberId: members.at(-1).account_id }
            : null,
        invitations,
        nextCursor:
          rows.length > 20
            ? { afterCreatedAt: last.createdAt, afterId: last.id }
            : null,
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
      const prior = (
        await tx.query(
          "SELECT actor_id,input_version FROM providers.invitation_revocations WHERE invitation_id=$1 AND organization_id=$2",
          [id, org],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor.id || prior.input_version !== version)
          throw new AppError(
            "REVOCATION_CONFLICT",
            "This invitation has a different recorded revocation.",
            409,
          );
        return { id, state: "revoked" };
      }
      const r = await tx.query(
        "UPDATE providers.invitations SET state='revoked',version=version+1 WHERE id=$1 AND organization_id=$2 AND version=$3 AND state='pending' RETURNING id,state",
        [id, org, version],
      );
      if (!r.rowCount)
        throw new AppError(
          "CONFLICT",
          "Invitation changed. Refresh its status.",
        );
      await tx.query(
        "INSERT INTO providers.invitation_revocations(invitation_id,organization_id,actor_id,input_version) VALUES($1,$2,$3,$4)",
        [id, org, actor.id, version],
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
    version: string,
    role: StaffRole | "revoke",
  ) {
    return transaction(async (tx) => {
      await this.owner(tx, actor, org);
      const prior = (
        await tx.query(
          "SELECT actor_id,action FROM providers.membership_commands WHERE organization_id=$1 AND account_id=$2 AND input_version=$3",
          [org, id, version],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor.id || prior.action !== role)
          throw new AppError(
            "MEMBERSHIP_COMMAND_CONFLICT",
            "This membership version already has a different recorded action.",
            409,
          );
        return { accountId: id, role: prior.action };
      }
      const row = (
        await tx.query(
          "SELECT role,version FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR UPDATE",
          [org, id],
        )
      ).rows[0];
      if (!row || row.version !== version)
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
      await tx.query(
        "INSERT INTO providers.membership_commands(organization_id,account_id,input_version,actor_id,action) VALUES($1,$2,$3,$4,$5)",
        [org, id, version, actor.id, role],
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
