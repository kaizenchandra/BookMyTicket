import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import type { BookingStore } from "../application/checkout.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresBookings implements BookingStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async lock(tx: Transaction, id: string) {
    return (
      await tx.query("SELECT * FROM bookings.orders WHERE id=$1 FOR UPDATE", [
        id,
      ])
    ).rows[0];
  }
  async confirm(tx: Transaction, id: string, paymentId: string) {
    await tx.query(
      "UPDATE bookings.orders SET state='confirmed',confirmed_payment_id=$2,confirmed_at=clock_timestamp() WHERE id=$1",
      [id, paymentId],
    );
  }
  async recovery(tx: Transaction, id: string) {
    await tx.query(
      "UPDATE bookings.orders SET state='refund_required' WHERE id=$1",
      [id],
    );
  }
  async list(ownerId: string) {
    return (
      await pool.query(
        "SELECT id,amount_paise,currency,state,created_at,confirmed_at,snapshot FROM bookings.orders WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 100",
        [ownerId],
      )
    ).rows;
  }
  async get(ownerId: string, id: string, tx?: Transaction) {
    const r = (
      await (tx ?? pool).query(
        "SELECT *,clock_timestamp() AS server_time FROM bookings.orders WHERE owner_id=$1 AND id=$2" +
          (tx ? " FOR SHARE" : ""),
        [ownerId, id],
      )
    ).rows[0];
    if (!r) throw new AppError("NOT_FOUND", "Booking not found.", 404);
    return r;
  }
}
