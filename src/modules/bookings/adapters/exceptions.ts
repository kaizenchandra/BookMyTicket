import { createHash } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  ExceptionStore,
  ExceptionInput,
  ExceptionRecord,
} from "../application/exceptions.ts";
export class PostgresBookingExceptions implements ExceptionStore {
  run<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async lockBooking(tx: Transaction, id: string) {
    if (
      !(
        await tx.query(
          "SELECT id FROM bookings.orders WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rowCount
    )
      throw new AppError("NOT_FOUND", "Booking not found.", 404);
  }
  async read(tx: Transaction, id: string) {
    return (
      (
        await tx.query(
          "SELECT * FROM bookings.admin_exceptions WHERE order_id=$1",
          [id],
        )
      ).rows[0] ?? null
    );
  }
  async history(tx: Transaction, id: string, before?: string) {
    const rows = (
      await tx.query(
        "SELECT h.*,h.id::text FROM bookings.admin_exception_history h WHERE order_id=$1 AND ($2::bigint IS NULL OR h.id<$2) ORDER BY h.id DESC LIMIT 26",
        [id, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].id : null,
    };
  }
  async once<T>(
    tx: Transaction,
    actor: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "booking-exception:" + actor + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(payload))
        .digest("hex"),
      prior = (
        await tx.query(
          "SELECT * FROM bookings.admin_exception_commands WHERE actor_id=$1 AND key=$2",
          [actor, key],
        )
      ).rows[0];
    if (prior) {
      if (prior.fingerprint !== fingerprint)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Key already used with different input.",
        );
      return prior.result as T;
    }
    const result = await work();
    await tx.query(
      "INSERT INTO bookings.admin_exception_commands VALUES($1,$2,$3,$4)",
      [actor, key, fingerprint, result],
    );
    return result;
  }
  async save(
    tx: Transaction,
    id: string,
    actor: string,
    input: ExceptionInput,
    before: ExceptionRecord | null,
    state: ExceptionRecord["state"],
    assignee: string | null,
  ) {
    const result = (
      await tx.query(
        "INSERT INTO bookings.admin_exceptions(order_id,state,assigned_to) VALUES($1,$2,$3) ON CONFLICT(order_id) DO UPDATE SET state=$2,assigned_to=$3,version=bookings.admin_exceptions.version+1,updated_at=clock_timestamp() RETURNING *",
        [id, state, assignee],
      )
    ).rows[0];
    await tx.query(
      "INSERT INTO bookings.admin_exception_history(order_id,actor_id,action,reason,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)",
      [id, actor, input.action, input.reason, before, result],
    );
    return result;
  }
}
