import type { ActiveAccount } from "../contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresActiveAccount implements ActiveAccount {
  async requireActive(tx: Transaction, actor: string) {
    if (
      !(
        await tx.query(
          "SELECT id FROM identity.accounts WHERE id=$1 AND status='active' FOR SHARE",
          [actor],
        )
      ).rowCount
    )
      throw new AppError("FORBIDDEN", "Active account required.", 403);
  }
}
