import { randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { FreeCancellationStore } from "../application/free-cancellation.ts";
export class PostgresFreeCancellation implements FreeCancellationStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async serialize(tx: Transaction, owner: string) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,20))", [
      owner,
    ]);
  }
  async lock(tx: Transaction, owner: string, id: string) {
    const row = (
      await tx.query(
        "SELECT o.*,EXISTS(SELECT 1 FROM bookings.free_confirmations f WHERE f.order_id=o.id) AS free_confirmed FROM bookings.orders o WHERE o.id=$1 AND o.owner_id=$2 FOR UPDATE OF o",
        [id, owner],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Booking not found.", 404);
    return row;
  }
  async preview(
    tx: Transaction,
    owner: string,
    id: string,
    fingerprint: string,
    expiry: Date,
  ) {
    const preview = randomUUID();
    await tx.query(
      "INSERT INTO bookings.free_cancel_previews(id,order_id,owner_id,fingerprint,expires_at) VALUES($1,$2,$3,$4,$5)",
      [preview, id, owner, fingerprint, expiry],
    );
    return preview;
  }
  async validate(
    tx: Transaction,
    owner: string,
    id: string,
    preview: string,
    fingerprint: string,
  ) {
    if (
      !(
        await tx.query(
          "SELECT 1 FROM bookings.free_cancel_previews WHERE id=$1 AND order_id=$2 AND owner_id=$3 AND fingerprint=$4 AND expires_at>clock_timestamp()",
          [preview, id, owner, fingerprint],
        )
      ).rowCount
    )
      throw new AppError(
        "PREVIEW_EXPIRED",
        "Review a fresh cancellation preview before confirming.",
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
        "SELECT fingerprint FROM bookings.free_cancel_commands WHERE owner_id=$1 AND operation_key=$2",
        [owner, key],
      )
    ).rows[0];
    if (row && row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "Cancellation key was used with different input.",
        409,
      );
    return !!row;
  }
  async cancelled(tx: Transaction, id: string) {
    return !!(
      await tx.query(
        "SELECT 1 FROM bookings.free_cancellations WHERE order_id=$1",
        [id],
      )
    ).rowCount;
  }
  async finish(tx: Transaction, owner: string, id: string, reason: string) {
    await tx.query("UPDATE bookings.orders SET state='cancelled' WHERE id=$1", [
      id,
    ]);
    await tx.query(
      "INSERT INTO bookings.free_cancellations(order_id,owner_id,reason) VALUES($1,$2,$3)",
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
      "INSERT INTO bookings.free_cancel_commands(owner_id,operation_key,fingerprint,order_id) VALUES($1,$2,$3,$4)",
      [owner, key, fingerprint, id],
    );
  }
}
