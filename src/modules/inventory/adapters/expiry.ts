import { transaction } from "../../../shared/database.ts";
import type { ReservationExpiryPort } from "../application/expiry.ts";
export class PostgresReservationExpiry implements ReservationExpiryPort {
  async expireBatch(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new Error("Invalid expiry batch limit");
    return transaction(async (tx) => {
      const expired = await tx.query(
        "WITH candidates AS (SELECT id FROM inventory.reservations WHERE state='active' AND expires_at<=clock_timestamp() ORDER BY expires_at,id FOR UPDATE SKIP LOCKED LIMIT $1) UPDATE inventory.reservations r SET state='expired',version=version+1 FROM candidates c WHERE r.id=c.id AND r.state='active' AND r.expires_at<=clock_timestamp() RETURNING r.id",
        [limit],
      );
      if (expired.rowCount)
        await tx.query(
          "UPDATE inventory.seat_ownership SET reservation_id=NULL,version=version+1 WHERE reservation_id=ANY($1::uuid[])",
          [expired.rows.map((r) => r.id)],
        );
      return expired.rowCount ?? 0;
    });
  }
}
