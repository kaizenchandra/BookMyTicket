import type { Transaction } from "../../../shared/database.ts";
import type {
  CustomerBookings,
  CustomerFilters,
} from "../../../shared/customer-admin.ts";
import { dashboardRecords } from "../../../shared/dashboard-records.ts";
export class PostgresCustomerBookings implements CustomerBookings {
  async owners(tx: Transaction, f: CustomerFilters) {
    if (!f.activity || f.activity === "all") return null;
    return (
      await tx.query(
        `SELECT owner_id FROM bookings.orders WHERE ($1::timestamptz IS NULL OR created_at >= $1) AND ($2::timestamptz IS NULL OR created_at < $2) GROUP BY owner_id ${f.activity === "repeat_confirmed" ? "HAVING count(*) FILTER(WHERE confirmed_at IS NOT NULL)>=2" : ""}`,
        [f.bookingFrom ?? null, f.bookingUntil ?? null],
      )
    ).rows.map((r) => r.owner_id);
  }
  async summaries(tx: Transaction, ids: string[]) {
    return Object.fromEntries(
      (
        await tx.query(
          `SELECT owner_id,count(*)::text AS bookings,count(*) FILTER(WHERE confirmed_at IS NOT NULL)::text AS confirmed,count(*) FILTER(WHERE state='cancelled')::text AS cancelled,max(created_at) AS "lastBookingAt" FROM bookings.orders WHERE owner_id=ANY($1::uuid[]) GROUP BY owner_id`,
          [ids],
        )
      ).rows.map(({ owner_id, ...r }) => [owner_id, r]),
    );
  }
  async ids(tx: Transaction, id: string) {
    return (
      await tx.query("SELECT id FROM bookings.orders WHERE owner_id=$1", [id])
    ).rows.map((r) => r.id as string);
  }
  history(
    tx: Transaction,
    id: string,
    after: string | undefined,
    scope: string,
  ) {
    return dashboardRecords(
      tx,
      `SELECT id,state,amount_paise::text,created_at AS at,coalesce(snapshot->'occurrences'->0->>'title','Booking') AS label,id AS booking_id FROM bookings.orders WHERE owner_id=$1`,
      [id],
      after,
      scope,
    );
  }
}
