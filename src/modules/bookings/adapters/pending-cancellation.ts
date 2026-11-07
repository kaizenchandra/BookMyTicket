import { randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { PendingCancellationStore } from "../application/pending-cancellation.ts";
export class PostgresPendingCancellation implements PendingCancellationStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async serialize(tx: Transaction, owner: string) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,15))", [
      owner,
    ]);
  }
  async lock(tx: Transaction, owner: string, id: string) {
    const row = (
      await tx.query(
        "SELECT id,state,reservation_id,clock_timestamp() AS server_time FROM bookings.orders WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [id, owner],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Order not found.", 404);
    return row;
  }
  async preview(tx: Transaction, owner: string, id: string, activity: boolean) {
    const existing = (
      await tx.query(
        "SELECT id,expires_at FROM bookings.pending_cancel_previews WHERE order_id=$1 AND owner_id=$2 AND payment_activity=$3 AND expires_at>clock_timestamp()",
        [id, owner, activity],
      )
    ).rows[0];
    if (existing) return existing;
    return (
      await tx.query(
        "INSERT INTO bookings.pending_cancel_previews(id,order_id,owner_id,payment_activity) VALUES($1,$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET id=EXCLUDED.id,payment_activity=EXCLUDED.payment_activity,expires_at=clock_timestamp()+interval '2 minutes' RETURNING id,expires_at",
        [randomUUID(), id, owner, activity],
      )
    ).rows[0];
  }
  async validatePreview(
    tx: Transaction,
    owner: string,
    id: string,
    preview: string,
    activity: boolean,
  ) {
    if (
      !(
        await tx.query(
          "SELECT id FROM bookings.pending_cancel_previews WHERE id=$1 AND order_id=$2 AND owner_id=$3 AND payment_activity=$4 AND expires_at>clock_timestamp()",
          [preview, id, owner, activity],
        )
      ).rowCount
    )
      throw new AppError(
        "CANCELLATION_PREVIEW_CHANGED",
        "The preview expired or payment activity changed. Review a fresh preview.",
        409,
      );
  }
  async prior(
    tx: Transaction,
    owner: string,
    key: string,
    fingerprint: string,
  ) {
    const row = (
      await tx.query(
        "SELECT fingerprint,order_id FROM bookings.pending_cancel_commands WHERE owner_id=$1 AND operation_key=$2",
        [owner, key],
      )
    ).rows[0];
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This cancellation key was used with different input.",
        409,
      );
    return row.order_id;
  }
  async record(tx: Transaction, owner: string, id: string, reason: string) {
    const updated = await tx.query(
      "UPDATE bookings.orders SET state='cancelled' WHERE id=$1 AND owner_id=$2 AND state='pending_payment' RETURNING id",
      [id, owner],
    );
    if (updated.rowCount !== 1)
      throw new AppError(
        "CANCELLATION_NOT_ALLOWED",
        "Order status changed before cancellation.",
        409,
      );
    await tx.query(
      "INSERT INTO bookings.pending_cancellations(order_id,owner_id,reason) VALUES($1,$2,$3)",
      [id, owner, reason],
    );
  }
  async command(
    tx: Transaction,
    owner: string,
    key: string,
    fingerprint: string,
    id: string,
  ) {
    await tx.query(
      "INSERT INTO bookings.pending_cancel_commands(owner_id,operation_key,fingerprint,order_id) VALUES($1,$2,$3,$4)",
      [owner, key, fingerprint, id],
    );
  }
  async result(tx: Transaction, id: string) {
    const row = (
      await tx.query(
        'SELECT order_id AS "orderId",created_at AS "cancelledAt" FROM bookings.pending_cancellations WHERE order_id=$1',
        [id],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "CANCELLATION_RECORD_UNAVAILABLE",
        "This cancellation requires support review.",
        409,
      );
    return { ...row, bookingState: "cancelled", refundStatus: "not_confirmed" };
  }
}
