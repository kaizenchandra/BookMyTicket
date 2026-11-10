import type { Transaction } from "../../../shared/database.ts";
import type { CustomerHistory } from "../../../shared/customer-admin.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class PostgresCustomerPayments implements CustomerHistory {
  history(
    tx: Transaction,
    ids: string[],
    after: string | undefined,
    scope: string,
  ) {
    return dashboardRecords(
      tx,
      `SELECT timeline_id AS id,'capture_recorded' AS state,amount_paise::text,captured_at AS at,'Captured payment' AS label,order_id AS booking_id FROM payments.captures WHERE order_id=ANY($1::uuid[])
 UNION ALL SELECT id,'recovery_'||state,amount_paise::text,created_at,'Payment recovery obligation',order_id FROM payments.recovery WHERE order_id=ANY($1::uuid[])
 UNION ALL SELECT id,'attempt_'||state,amount_paise::text,recorded_at,'Payment attempt observation',order_id FROM payments.attempt_observations WHERE order_id=ANY($1::uuid[])`,
      [ids],
      after,
      scope,
    );
  }
}
