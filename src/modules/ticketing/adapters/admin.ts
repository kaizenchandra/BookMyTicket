import type { Transaction } from "../../../shared/database.ts";
import type { AdminFulfillment } from "../contracts/admin.ts";
export class PostgresAdminFulfillment implements AdminFulfillment {
  async summary(tx: Transaction, booking: string) {
    return (
      await tx.query(
        "SELECT state,count(*)::text AS count FROM ticketing.tickets WHERE order_id=$1 GROUP BY state ORDER BY state",
        [booking],
      )
    ).rows;
  }
}
