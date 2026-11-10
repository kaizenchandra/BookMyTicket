import type { Transaction } from "../../../shared/database.ts";
import type { CustomerHistory } from "../../../shared/customer-admin.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class PostgresCustomerSupport implements CustomerHistory {
  history(
    tx: Transaction,
    ids: string[],
    after: string | undefined,
    scope: string,
  ) {
    return dashboardRecords(
      tx,
      `SELECT id,state,NULL::text AS amount_paise,created_at AS at,category||' · '||priority AS label,booking_id FROM support.cases WHERE owner_id=ANY($1::uuid[])`,
      [ids],
      after,
      scope,
    );
  }
}
