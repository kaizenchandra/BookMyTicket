import type { Transaction } from "../../../shared/database.ts";
import type { DashboardPeriod } from "../../../shared/dashboard.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class BookingDashboardRecords {
  records(
    tx: Transaction,
    p: DashboardPeriod,
    kind: string,
    after?: string,
    scope = "",
  ) {
    const where = `created_at >= $1 AND created_at < $2 AND ($3::text[] IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) o WHERE o->>'listingId'=ANY($3))) AND ($4::text IS NULL OR state=$4)`;
    const query =
      kind === "customers"
        ? `SELECT owner_id AS id,'booking_active' AS state,NULL::text AS amount_paise,max(created_at) AS at,'Customer reference' AS label FROM bookings.orders WHERE ${where} GROUP BY owner_id`
        : `SELECT id,state,amount_paise::text,created_at AS at,coalesce(snapshot->'occurrences'->0->>'title','Booking') AS label,id AS booking_id FROM bookings.orders WHERE ${where} ${kind === "confirmed" ? "AND confirmed_at IS NOT NULL" : kind === "cancelled" ? "AND state='cancelled'" : ""}`;
    return dashboardRecords(
      tx,
      query,
      [p.from, p.until, p.listingIds ?? null, p.state ?? null],
      after,
      scope,
    );
  }
}
