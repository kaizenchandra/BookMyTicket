import type { Transaction } from "../../../shared/database.ts";
import type {
  DashboardPeriod,
  DashboardSource,
} from "../../../shared/dashboard.ts";
export class SupportDashboard implements DashboardSource {
  async read(tx: Transaction, p: DashboardPeriod) {
    return (
      await tx.query(
        `SELECT count(*) FILTER(WHERE state<>'resolved')::text AS open_cases,count(*) FILTER(WHERE state='escalated')::text AS escalated_cases,count(*) FILTER(WHERE state<>'resolved' AND priority IN ('high','urgent'))::text AS urgent_cases FROM support.cases WHERE created_at >= $1 AND created_at < $2 AND ($3::uuid[] IS NULL OR booking_id=ANY($3))`,
        [p.from, p.until, p.bookingIds ?? null],
      )
    ).rows[0];
  }
}
