import type {
  DashboardSource,
  DashboardPeriod,
} from "../../../shared/dashboard.ts";
import type { Transaction } from "../../../shared/database.ts";
export class BookingDashboard implements DashboardSource {
  async matching(tx: Transaction, listings: string[] | null, state?: string) {
    if (listings === null && !state) return null;
    return (
      await tx.query(
        `SELECT id FROM bookings.orders WHERE ($1::text[] IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) o WHERE o->>'listingId'=ANY($1))) AND ($2::text IS NULL OR state=$2)`,
        [listings, state ?? null],
      )
    ).rows.map((r) => r.id as string);
  }
  async read(tx: Transaction, period: DashboardPeriod) {
    const args = [
      period.from,
      period.until,
      period.listingIds ?? null,
      period.state ?? null,
    ];
    const filter = ` AND ($3::text[] IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) o WHERE o->>'listingId'=ANY($3))) AND ($4::text IS NULL OR state=$4)`;
    const summary = await tx.query(
      `SELECT count(*)::text AS bookings,count(DISTINCT owner_id)::text AS active_customers,
      count(*) FILTER (WHERE confirmed_at IS NOT NULL)::text AS confirmed,
      count(*) FILTER (WHERE state='cancelled')::text AS cancelled,
      coalesce(sum(amount_paise) FILTER (WHERE confirmed_at IS NOT NULL),0)::text AS gbv,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) o WHERE o->>'isDemo'='true'))::text AS demo_bookings
      FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter}`,
      args,
    );
    const repeat = await tx.query(
      `WITH customers AS (
      SELECT owner_id,count(*) AS n FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} AND confirmed_at IS NOT NULL GROUP BY owner_id)
      SELECT count(*)::text AS customers,count(*) FILTER (WHERE n>1)::text AS repeat_customers FROM customers`,
      args,
    );
    const trend = await tx.query(
      `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM') AS month,
      count(*)::text AS bookings,coalesce(sum(amount_paise) FILTER (WHERE confirmed_at IS NOT NULL),0)::text AS gbv
      FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} GROUP BY 1 ORDER BY 1`,
      args,
    );
    const latest = await tx.query(
      `SELECT id,state,amount_paise::text,created_at,confirmed_at,
      coalesce(snapshot->'occurrences'->0->>'title','Booking') AS title
      FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} ORDER BY created_at DESC,id DESC LIMIT 20`,
      args,
    );
    const lines = await tx.query(
      `SELECT CASE WHEN jsonb_array_length(coalesce(snapshot->'occurrences','[]'))=1 THEN snapshot->'occurrences'->0->>'listingId' ELSE NULL END AS listing_id,
      count(*)::text AS bookings,count(*) FILTER(WHERE confirmed_at IS NOT NULL)::text AS confirmed,coalesce(sum(amount_paise) FILTER(WHERE confirmed_at IS NOT NULL),0)::text AS gbv FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} GROUP BY 1`,
      args,
    );
    const timeseries = await tx.query(
      `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata',$5) AS bucket,count(*)::text AS bookings,coalesce(sum(amount_paise) FILTER(WHERE confirmed_at IS NOT NULL),0)::text AS gbv FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} GROUP BY 1 ORDER BY 1`,
      [...args, period.grain === "day" ? "YYYY-MM-DD" : "YYYY-MM"],
    );
    const states = await tx.query(
      `SELECT state,count(*)::text AS bookings,coalesce(sum(amount_paise),0)::text AS amount_paise FROM bookings.orders WHERE created_at >= $1 AND created_at < $2${filter} GROUP BY state ORDER BY state`,
      args,
    );
    return {
      timeseries: timeseries.rows,
      states: states.rows,
      lines: lines.rows,
      ...summary.rows[0],
      ...repeat.rows[0],
      trend: trend.rows,
      latest: latest.rows,
    };
  }
}
