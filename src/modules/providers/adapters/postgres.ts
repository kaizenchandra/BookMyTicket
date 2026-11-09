import { requireCompleteOnboarding } from "../domain/onboarding.ts";
import { requireEditableOrganization } from "../domain/draft.ts";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { OrganizationAccess } from "../contracts/index.ts";
export class PostgresProviders implements OrganizationAccess {
  async list(actorId: string) {
    return (
      await pool.query(
        "SELECT o.*,m.role FROM providers.organizations o JOIN providers.memberships m ON m.organization_id=o.id WHERE m.account_id=$1 ORDER BY o.created_at DESC",
        [actorId],
      )
    ).rows;
  }
  async requireExport(actorId: string, id: string, tx: Transaction) {
    if (
      !(
        await tx.query(
          "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 AND role='owner' FOR SHARE",
          [id, actorId],
        )
      ).rowCount
    )
      throw new AppError(
        "FORBIDDEN",
        "Only an organization owner can export attendees.",
        403,
      );
    await this.requireApproved(id, tx);
  }
  async requireMember(
    actorId: string,
    id: string,
    write = false,
    tx?: Transaction,
  ) {
    const r = await (tx ?? pool).query(
      "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2" +
        (tx ? " FOR SHARE" : ""),
      [id, actorId],
    );
    if (!r.rowCount || (write && r.rows[0].role === "viewer"))
      throw new AppError("FORBIDDEN", "Organization access denied.", 403);
  }
  async requireApproved(id: string, tx?: Transaction) {
    const r = await (tx ?? pool).query(
      "SELECT 1 FROM providers.organizations WHERE id=$1 AND state='approved'" +
        (tx ? " FOR SHARE" : ""),
      [id],
    );
    if (!r.rowCount)
      throw new AppError(
        "PROVIDER_NOT_APPROVED",
        "Provider approval is required.",
        403,
      );
  }
  private async lockOwner(tx: Transaction, actor: string, id: string) {
    const row = (
      await tx.query(
        "SELECT * FROM providers.organizations WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    const member = (
      await tx.query(
        "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR SHARE",
        [id, actor],
      )
    ).rows[0];
    if (!row || member?.role !== "owner")
      throw new AppError(
        "FORBIDDEN",
        "Only organization owners can change onboarding drafts.",
        403,
      );
    return row;
  }
  async edit(actor: string, id: string, name: string, version: number) {
    return transaction(async (tx) => {
      const row = await this.lockOwner(tx, actor, id);
      const prior = (
        await tx.query(
          "SELECT actor_id,name,result FROM providers.draft_edits WHERE organization_id=$1 AND input_version=$2",
          [id, version],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor || prior.name !== name)
          throw new AppError(
            "DRAFT_CONFLICT",
            "This draft version already has a different recorded edit.",
            409,
          );
        return prior.result;
      }
      requireEditableOrganization(row.state);
      if (row.version !== version) {
        throw new AppError(
          "VERSION_CONFLICT",
          "Organization changed. Reload and review the latest draft.",
          409,
        );
      }
      const result = (
        await tx.query(
          "UPDATE providers.organizations SET name=$2,version=version+1 WHERE id=$1 RETURNING *",
          [id, name],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO providers.draft_edits(organization_id,input_version,version,actor_id,name,result) VALUES($1,$2,$3,$4,$5,$6)",
        [id, version, result.version, actor, name, result],
      );
      return result;
    });
  }
  async submit(actor: string, id: string, version: number) {
    return transaction(async (tx) => {
      const row = await this.lockOwner(tx, actor, id);
      const prior = (
        await tx.query(
          "SELECT actor_id,result FROM providers.submissions WHERE organization_id=$1 AND input_version=$2",
          [id, version],
        )
      ).rows[0];
      if (prior) {
        if (prior.actor_id !== actor)
          throw new AppError(
            "SUBMISSION_CONFLICT",
            "This version was submitted by another owner.",
            409,
          );
        return prior.result;
      }
      requireEditableOrganization(row.state);
      if (row.version !== version)
        throw new AppError(
          "VERSION_CONFLICT",
          "Organization changed. Reload and review before submitting.",
          409,
        );
      requireCompleteOnboarding(
        (
          await tx.query(
            'SELECT legal_name AS "legalName",business_address AS "businessAddress",contact_name AS "contactName",contact_email AS "contactEmail",contact_phone AS "contactPhone" FROM providers.onboarding_details WHERE organization_id=$1',
            [id],
          )
        ).rows[0],
      );
      const result = (
        await tx.query(
          "UPDATE providers.organizations SET state='submitted',version=version+1 WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO providers.submissions(organization_id,input_version,version,actor_id,result) VALUES($1,$2,$3,$4,$5)",
        [id, version, result.version, actor, result],
      );
      return result;
    });
  }
}
