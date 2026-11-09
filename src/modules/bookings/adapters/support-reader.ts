import type { SupportBookingReader } from "../contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresSupportBookingReader implements SupportBookingReader {
  async readOwned(tx: Transaction, owner: string, id: string) {
    const row = (
      await tx.query(
        'SELECT id,state,amount_paise AS "amountPaise",currency,created_at AS "createdAt" FROM bookings.orders WHERE id=$1 AND owner_id=$2 FOR SHARE',
        [id, owner],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "NOT_FOUND",
        "Booking not found in this account.",
        404,
      );
    return row;
  }
}
