import { randomUUID } from "node:crypto";
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
  async create(actorId: string, name: string, kind: string) {
    return transaction(async (tx) => {
      const id = randomUUID();
      await tx.query(
        "INSERT INTO providers.organizations(id,owner_id,name,kind) VALUES($1,$2,$3,$4)",
        [id, actorId, name, kind],
      );
      await tx.query(
        "INSERT INTO providers.memberships VALUES($1,$2,'owner')",
        [id, actorId],
      );
      return { id, name, kind, state: "draft", version: 1 };
    });
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
  async submit(actorId: string, id: string, version: number) {
    return transaction(async (tx) => {
      // Membership is rechecked inside the mutation, not inferred from frontend organization selection.
      const r = await tx.query(
        "UPDATE providers.organizations o SET state='submitted',version=version+1 WHERE id=$1 AND version=$2 AND state IN ('draft','changes_requested') AND EXISTS(SELECT 1 FROM providers.memberships m WHERE m.organization_id=o.id AND m.account_id=$3 AND m.role='owner') RETURNING *",
        [id, version, actorId],
      );
      if (!r.rowCount)
        throw new AppError(
          "CONFLICT",
          "Access, version, or onboarding state has changed.",
        );
      return r.rows[0];
    });
  }
}
