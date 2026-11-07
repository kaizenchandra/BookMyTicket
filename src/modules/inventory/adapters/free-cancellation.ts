import { createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { FreeCancellationInventory } from "../contracts/index.ts";
export class PostgresFreeCancellationInventory implements FreeCancellationInventory {
  async inspect(
    tx: Transaction,
    owner: string,
    reservation: string,
    cutoffMinutes: number,
  ) {
    const occurrences = (
      await tx.query(
        "SELECT o.* FROM inventory.occurrences o WHERE id IN (SELECT occurrence_id FROM inventory.reservation_items WHERE reservation_id=$1) ORDER BY id FOR UPDATE",
        [reservation],
      )
    ).rows;
    const r = (
      await tx.query(
        "SELECT state,version FROM inventory.reservations WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [reservation, owner],
      )
    ).rows[0];
    if (!r || r.state !== "consumed" || !occurrences.length)
      throw new AppError(
        "CANCELLATION_UNAVAILABLE",
        "Confirmed inventory is unavailable for cancellation.",
        409,
      );
    const resources = (
      await tx.query(
        "SELECT s.*,i.quantity FROM inventory.resources s JOIN inventory.reservation_items i ON i.occurrence_id=s.occurrence_id AND i.resource_id=s.id WHERE i.reservation_id=$1 ORDER BY s.occurrence_id,s.id FOR UPDATE OF s",
        [reservation],
      )
    ).rows;
    const now = (await tx.query("SELECT clock_timestamp() now")).rows[0]
      .now as Date;
    const deadline = Math.min(
      ...occurrences.map((o) => o.starts_at.getTime() - cutoffMinutes * 60000),
    );
    if (
      occurrences.some((o) => !["open", "paused"].includes(o.state)) ||
      now.getTime() >= deadline
    )
      throw new AppError(
        "CANCELLATION_CLOSED",
        "The cancellation deadline passed or occurrence requires support review.",
        409,
      );
    return {
      fingerprint: createHash("sha256")
        .update(
          JSON.stringify({
            reservation,
            version: r.version,
            occurrences: occurrences.map((o) => [
              o.id,
              o.version,
              o.state,
              o.starts_at,
            ]),
          }),
        )
        .digest("hex"),
      quantity: resources.reduce((n, i) => n + i.quantity, 0),
      expiresAt: new Date(Math.min(deadline, now.getTime() + 120000)),
      items: resources.map((i) => ({
        occurrenceId: i.occurrence_id,
        resourceId: i.id,
        label: i.label,
        quantity: i.quantity,
      })),
    };
  }
  async release(tx: Transaction, owner: string, reservation: string) {
    const items = (
      await tx.query(
        "SELECT i.*,r.kind FROM inventory.reservation_items i JOIN inventory.resources r ON r.occurrence_id=i.occurrence_id AND r.id=i.resource_id WHERE reservation_id=$1 ORDER BY occurrence_id,resource_id",
        [reservation],
      )
    ).rows;
    for (const i of items) {
      if (
        i.kind === "seat" &&
        !(
          await tx.query(
            "SELECT 1 FROM inventory.seat_ownership WHERE occurrence_id=$1 AND resource_id=$2 AND reservation_id=$3 FOR UPDATE",
            [i.occurrence_id, i.resource_id, reservation],
          )
        ).rowCount
      )
        throw new AppError(
          "INVENTORY_CONFLICT",
          "Seat ownership requires review.",
          409,
        );
      const updated = await tx.query(
        "UPDATE inventory.resources SET sold=sold-$3,version=version+1 WHERE occurrence_id=$1 AND id=$2 AND sold>=$3",
        [i.occurrence_id, i.resource_id, i.quantity],
      );
      if (updated.rowCount !== 1)
        throw new AppError(
          "INVENTORY_CONFLICT",
          "Sold capacity requires review.",
          409,
        );
    }
    await tx.query(
      "UPDATE inventory.seat_ownership SET reservation_id=NULL,version=version+1 WHERE reservation_id=$1",
      [reservation],
    );
    const released = await tx.query(
      "UPDATE inventory.reservations SET state='released',version=version+1 WHERE id=$1 AND owner_id=$2 AND state='consumed'",
      [reservation, owner],
    );
    if (released.rowCount !== 1)
      throw new AppError("INVENTORY_CONFLICT", "Reservation changed.", 409);
  }
}
