import type { Transaction } from "../../../shared/database.ts";
import type { PolicyTarget } from "../contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresPolicyTarget implements PolicyTarget {
  async lockForPolicy(tx: Transaction, id: string) {
    const row = (
      await tx.query(
        "SELECT state FROM inventory.occurrences WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Occurrence not found.", 404);
    if (["cancelled", "closed"].includes(row.state))
      throw new AppError(
        "OCCURRENCE_CLOSED",
        "Cannot configure sales policies for a closed occurrence.",
        409,
      );
  }
}
