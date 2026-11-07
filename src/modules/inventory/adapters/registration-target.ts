import type { Transaction } from "../../../shared/database.ts";
import type { RegistrationTarget } from "../contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresRegistrationTarget implements RegistrationTarget {
  async lockForRegistration(tx: Transaction, id: string) {
    const row = (
      await tx.query(
        "SELECT organization_id,state FROM inventory.occurrences WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Occurrence not found.", 404);
    return { organizationId: row.organization_id, state: row.state };
  }
}
