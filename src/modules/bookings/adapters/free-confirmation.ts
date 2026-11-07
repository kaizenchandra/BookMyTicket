import type { Transaction } from "../../../shared/database.ts";
import { PostgresBookings } from "./postgres.ts";
import type { FreeBookingStore } from "../application/free-confirmation.ts";
export class PostgresFreeBookings
  extends PostgresBookings
  implements FreeBookingStore
{
  async serializeFree(tx: Transaction, owner: string) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,19))", [
      owner,
    ]);
  }
  async priorFree(tx: Transaction, owner: string, key: string) {
    return (
      (
        await tx.query(
          "SELECT order_id FROM bookings.free_confirmation_commands WHERE owner_id=$1 AND operation_key=$2",
          [owner, key],
        )
      ).rows[0]?.order_id ?? null
    );
  }
  async isFreeConfirmed(tx: Transaction, id: string) {
    return !!(
      await tx.query(
        "SELECT 1 FROM bookings.free_confirmations WHERE order_id=$1",
        [id],
      )
    ).rowCount;
  }
  async confirmFree(tx: Transaction, owner: string, id: string) {
    await tx.query(
      "UPDATE bookings.orders SET state='confirmed',confirmed_at=clock_timestamp() WHERE id=$1",
      [id],
    );
    await tx.query(
      "INSERT INTO bookings.free_confirmations(order_id,owner_id) VALUES($1,$2)",
      [id, owner],
    );
  }
  async recordFreeCommand(
    tx: Transaction,
    owner: string,
    key: string,
    id: string,
  ) {
    await tx.query(
      "INSERT INTO bookings.free_confirmation_commands(owner_id,operation_key,order_id) VALUES($1,$2,$3)",
      [owner, key, id],
    );
  }
}
