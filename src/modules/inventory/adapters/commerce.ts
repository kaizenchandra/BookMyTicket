import type { PublishedCatalog } from "../../catalog/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import type { Transaction } from "../../../shared/database.ts";
import type {
  InventoryCommerce,
  ReservedSnapshot,
} from "../contracts/index.ts";
export class PostgresInventoryCommerce implements InventoryCommerce {
  constructor(private catalog: PublishedCatalog) {}
  async snapshot(
    tx: Transaction,
    ownerId: string,
    id: string,
  ): Promise<ReservedSnapshot> {
    const ownership = await tx.query(
      "SELECT 1 FROM inventory.reservations WHERE id=$1 AND owner_id=$2",
      [id, ownerId],
    );
    if (!ownership.rowCount)
      throw new AppError("NOT_FOUND", "Reservation not found.", 404);
    const occurrences = (
      await tx.query(
        `SELECT o.*,clock_timestamp()>=o.sales_open AND clock_timestamp()<o.sales_close AS sales_valid FROM inventory.occurrences o WHERE o.id IN (SELECT occurrence_id FROM inventory.reservation_items WHERE reservation_id=$1) ORDER BY o.id FOR UPDATE`,
        [id],
      )
    ).rows;
    if (
      !occurrences.length ||
      occurrences.some((o) => o.state !== "open" || !o.sales_valid)
    )
      throw new AppError(
        "SALES_CLOSED",
        "Sales are no longer open for this reservation.",
        409,
      );
    for (const occurrence of occurrences)
      await this.catalog.requirePublished(occurrence.listing_id, tx);
    const r = (
      await tx.query(
        "SELECT *,expires_at>clock_timestamp() fresh FROM inventory.reservations WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [id, ownerId],
      )
    ).rows[0];
    if (!r) throw new AppError("NOT_FOUND", "Reservation not found.", 404);
    if (r.state !== "active" || !r.fresh)
      throw new AppError(
        "RESERVATION_EXPIRED",
        "Reserve your selection again before checkout.",
      );
    const now = (await tx.query("SELECT clock_timestamp() now")).rows[0]
      .now as Date;
    if (r.expires_at <= now)
      throw new AppError(
        "RESERVATION_EXPIRED",
        "Reserve your selection again before checkout.",
        409,
      );
    if (occurrences.some((o) => o.sales_open > now || o.sales_close <= now))
      throw new AppError(
        "SALES_CLOSED",
        "Sales are no longer open for this reservation.",
        409,
      );
    const items = (
      await tx.query(
        "SELECT occurrence_id,resource_id,quantity,unit_price_paise FROM inventory.reservation_items WHERE reservation_id=$1 ORDER BY occurrence_id,resource_id",
        [id],
      )
    ).rows;
    return {
      id,
      expires_at: r.expires_at,
      items,
      subtotalPaise: items.reduce(
        (n, i) => n + i.quantity * i.unit_price_paise,
        0,
      ),
      currency: "INR",
      occurrences: occurrences.map((o) => ({
        id: o.id,
        listingId: o.listing_id,
        isDemo: o.is_demo,
        venueName: o.venue_name,
        timeZone: o.time_zone,
        startsAt: o.starts_at.toISOString(),
        endsAt: o.ends_at.toISOString(),
      })),
    };
  }
  async consume(
    tx: Transaction,
    ownerId: string,
    id: string,
    options?: { requireActive: boolean },
  ) {
    // Confirmation takes the same occurrence gate locks as allocation before touching resource rows.
    const items = (
      await tx.query(
        "SELECT * FROM inventory.reservation_items WHERE reservation_id=$1 ORDER BY occurrence_id,resource_id",
        [id],
      )
    ).rows;
    if (!items.length) return false;
    const occurrences = await tx.query(
      "SELECT * FROM inventory.occurrences WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
      [[...new Set(items.map((i) => i.occurrence_id))]],
    );
    if (occurrences.rows.some((o) => o.state !== "open")) return false;
    const r = (
      await tx.query(
        "SELECT *,expires_at>clock_timestamp() fresh FROM inventory.reservations WHERE id=$1 AND owner_id=$2 FOR UPDATE",
        [id, ownerId],
      )
    ).rows[0];
    if (!r || r.state === "released" || r.state === "consumed") return false;
    // Late capture can reacquire only the original resources, never replace another valid hold.
    for (const i of items) {
      const resource = (
        await tx.query(
          "SELECT * FROM inventory.resources WHERE occurrence_id=$1 AND id=$2 FOR UPDATE",
          [i.occurrence_id, i.resource_id],
        )
      ).rows[0];
      const held = (
        await tx.query(
          "SELECT coalesce(sum(i.quantity),0)::int n FROM inventory.reservation_items i JOIN inventory.reservations r ON r.id=i.reservation_id WHERE i.occurrence_id=$1 AND i.resource_id=$2 AND r.id<>$3 AND r.state='active' AND r.expires_at>clock_timestamp()",
          [i.occurrence_id, i.resource_id, id],
        )
      ).rows[0].n;
      if (resource.sold + held + i.quantity > resource.capacity) return false;
    }
    if (options?.requireActive) {
      const now = (await tx.query("SELECT clock_timestamp() now")).rows[0]
        .now as Date;
      if (
        r.state !== "active" ||
        r.expires_at <= now ||
        occurrences.rows.some((o) => o.sales_open > now || o.sales_close <= now)
      )
        return false;
    }
    for (const i of items) {
      await tx.query(
        "UPDATE inventory.resources SET sold=sold+$3,version=version+1 WHERE occurrence_id=$1 AND id=$2",
        [i.occurrence_id, i.resource_id, i.quantity],
      );
      await tx.query(
        "UPDATE inventory.seat_ownership SET reservation_id=$3,version=version+1 WHERE occurrence_id=$1 AND resource_id=$2",
        [i.occurrence_id, i.resource_id, id],
      );
    }
    await tx.query(
      "UPDATE inventory.reservations SET state='consumed',version=version+1 WHERE id=$1",
      [id],
    );
    return true;
  }
}
