import { randomUUID } from "node:crypto";
import type { ActiveAccount } from "../../identity/contracts/index.ts";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  OrganizationCreationInput,
  OrganizationCreationPort,
} from "../application/creation.ts";
export class PostgresOrganizationCreation implements OrganizationCreationPort {
  constructor(private accounts: ActiveAccount) {}
  create(actor: string, input: OrganizationCreationInput, key: string) {
    return transaction(async (tx) => {
      await this.accounts.requireActive(tx, actor);
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,58))", [
        JSON.stringify(["provider.create", actor, key]),
      ]);
      const prior = (
        await tx.query(
          "SELECT organization_id,input=$3::jsonb AS matches,result FROM providers.creations WHERE actor_id=$1 AND operation_key=$2",
          [actor, key, input],
        )
      ).rows[0];
      if (prior) {
        const member = (
          await tx.query(
            "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR SHARE",
            [prior.organization_id, actor],
          )
        ).rows[0];
        if (member?.role !== "owner")
          throw new AppError(
            "FORBIDDEN",
            "Current organization ownership is required to recover this creation.",
            403,
          );
        if (!prior.matches)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This creation key was already used for different organization details.",
            409,
          );
        return prior.result;
      }
      const result = (
        await tx.query(
          "INSERT INTO providers.organizations(id,owner_id,name,kind) VALUES($1,$2,$3,$4) RETURNING id,name,kind,state,version",
          [randomUUID(), actor, input.name, input.kind],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
        [result.id, actor],
      );
      await tx.query(
        "INSERT INTO providers.creations(actor_id,operation_key,organization_id,input,result) VALUES($1,$2,$3,$4,$5)",
        [actor, key, result.id, input, result],
      );
      return result;
    });
  }
}
