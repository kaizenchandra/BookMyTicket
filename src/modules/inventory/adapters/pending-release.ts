import type { Transaction } from "../../../shared/database.ts";
import type { PendingOrderRelease } from "../contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresPendingRelease implements PendingOrderRelease {
  async release(tx: Transaction, owner: string, id: string) {
    await tx.query(
      "SELECT id FROM inventory.occurrences WHERE id IN (SELECT occurrence_id FROM inventory.reservation_items WHERE reservation_id=$1) ORDER BY id FOR UPDATE",
      [id],
    );
    const row = (
      await tx.query(
        "SELECT state FROM inventory.reservations WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [id, owner],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Reservation not found.", 404);
    if (row.state === "consumed")
      throw new AppError(
        "ALREADY_CONSUMED",
        "Confirmed inventory cannot be released as a pending hold.",
        409,
      );
    await tx.query(
      "UPDATE inventory.reservations SET state='released',version=version+1 WHERE id=$1 AND state IN ('active','expired')",
      [id],
    );
    await tx.query(
      "UPDATE inventory.seat_ownership SET reservation_id=NULL,version=version+1 WHERE reservation_id=$1",
      [id],
    );
  }
}
