import type { Transaction } from "../../../shared/database.ts";
import type { DashboardPeriod } from "../../../shared/dashboard.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class SupportDashboardRecords {
  records(
    tx: Transaction,
    p: DashboardPeriod,
    kind: string,
    after?: string,
    scope = "",
  ) {
    return dashboardRecords(
      tx,
      `SELECT id,state,NULL::text AS amount_paise,created_at AS at,'Support case' AS label,booking_id FROM support.cases WHERE created_at >= $1 AND created_at < $2 AND state<>'resolved' AND ($3::uuid[] IS NULL OR booking_id=ANY($3))`,
      [p.from, p.until, p.bookingIds ?? null],
      after,
      scope,
    );
  }
}
