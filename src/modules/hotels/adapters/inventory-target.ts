import type { HotelInventoryTarget } from "../contracts/inventory.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresHotelInventoryTarget implements HotelInventoryTarget {
  async lock(tx: Transaction, id: string) {
    const r = await tx.query(
      "SELECT state FROM hotels.properties WHERE id=$1 FOR SHARE",
      [id],
    );
    if (!r.rowCount)
      throw new AppError("NOT_FOUND", "Property not found.", 404);
    return r.rows[0] as { state: string };
  }
}
