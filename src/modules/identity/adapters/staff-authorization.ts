import type { StaffAuthorization } from "../contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresStaffAuthorization implements StaffAuthorization {
  async requirePermission(tx: Transaction, actor: string, permission: string) {
    const account = await tx.query(
      "SELECT id FROM identity.accounts WHERE id=$1 AND status='active' FOR SHARE",
      [actor],
    );
    const grant = await tx.query(
      "SELECT account_id FROM identity.grants WHERE account_id=$1 AND permission=$2 AND scope='platform' FOR SHARE",
      [actor, permission],
    );
    if (!account.rowCount || !grant.rowCount)
      throw new AppError(
        "FORBIDDEN",
        "An active staff account with the required permission is needed.",
        403,
      );
  }
}
