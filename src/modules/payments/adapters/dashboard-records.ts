import type { Transaction } from "../../../shared/database.ts";
import type { DashboardPeriod } from "../../../shared/dashboard.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class PaymentDashboardRecords {
  records(
    tx: Transaction,
    p: DashboardPeriod,
    kind: string,
    after?: string,
    scope = "",
  ) {
    const queries: Record<string, string> = {
      captures: `SELECT timeline_id AS id,'capture_recorded' AS state,amount_paise::text,captured_at AS at,'Captured payment' AS label,order_id AS booking_id FROM payments.captures WHERE captured_at >= $1 AND captured_at < $2`,
      recovery: `SELECT id,state,amount_paise::text,created_at AS at,'Recovery obligation' AS label,order_id AS booking_id FROM payments.recovery WHERE created_at >= $1 AND created_at < $2 AND state='review_required'`,
      refunded: `SELECT timeline_id AS id,state,amount_paise::text,observed_at AS at,'Original payment amount; not refund amount' AS label,order_id AS booking_id FROM payments.attempts WHERE observed_at >= $1 AND observed_at < $2 AND state='refunded'`,
      failed: `SELECT timeline_id AS id,state,amount_paise::text,observed_at AS at,'Failed payment attempt' AS label,order_id AS booking_id FROM payments.attempts WHERE observed_at >= $1 AND observed_at < $2 AND state='failed'`,
      exceptions: `SELECT order_id AS id,state,amount_paise::text,created_at AS at,'Payment order exception' AS label,order_id AS booking_id FROM payments.provider_orders WHERE created_at >= $1 AND created_at < $2 AND (state IN ('failed','unknown') OR review_required)`,
    };
    return dashboardRecords(
      tx,
      queries[kind] + ` AND ($3::uuid[] IS NULL OR order_id=ANY($3))`,
      [p.from, p.until, p.bookingIds ?? null],
      after,
      scope,
    );
  }
}
