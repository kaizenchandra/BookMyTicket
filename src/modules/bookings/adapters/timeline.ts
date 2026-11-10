import { pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { BookingTimelineStore } from "../application/timeline.ts";
export class PostgresBookingTimeline implements BookingTimelineStore {
  async get(owner: string, booking: string) {
    // One statement provides a consistent snapshot of state and recorded milestones.
    const result = await pool.query(
      `
      WITH owned AS (
        SELECT id,owner_id,state,created_at,accepted_at,confirmed_at FROM bookings.orders WHERE owner_id=$1 AND id=$2
      ), milestones AS (
        SELECT 'created' AS kind,created_at AS at,10 AS rank FROM owned
        UNION ALL SELECT 'policies_accepted',accepted_at,20 FROM owned WHERE accepted_at IS NOT NULL
        UNION ALL SELECT 'confirmed',confirmed_at,30 FROM owned WHERE confirmed_at IS NOT NULL
        UNION ALL SELECT 'pending_cancelled',c.created_at,40 FROM bookings.pending_cancellations c JOIN owned o ON c.order_id=o.id AND c.owner_id=o.owner_id
        UNION ALL SELECT 'free_cancelled',c.created_at,50 FROM bookings.free_cancellations c JOIN owned o ON c.order_id=o.id AND c.owner_id=o.owner_id
      )
      SELECT id AS "bookingId",state AS "currentState",statement_timestamp() AS "serverTime",
        (SELECT coalesce(jsonb_agg(jsonb_build_object('kind',kind,'occurredAt',to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) ORDER BY at,rank),'[]'::jsonb) FROM milestones) AS items
      FROM owned`,
      [owner, booking],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Booking not found.", 404);
    return result.rows[0];
  }
}
