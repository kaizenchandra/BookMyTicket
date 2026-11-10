import type { StaffAuthorization } from "../contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresStaffAuthorization implements StaffAuthorization {
  async hasPermission(tx: Transaction, actor: string, permission: string) {
    return !!(
      await tx.query(
        "SELECT a.id FROM identity.accounts a JOIN identity.grants g ON g.account_id=a.id WHERE a.id=$1 AND a.status='active' AND g.permission=$2 AND g.scope='platform' FOR SHARE OF a,g",
        [actor, permission],
      )
    ).rowCount;
  }
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
