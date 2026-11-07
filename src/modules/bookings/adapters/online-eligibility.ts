import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { OnlineEligibility } from "../../events/contracts/index.ts";
import type { TicketOccurrences } from "../../inventory/contracts/index.ts";
import type { TicketReader } from "../../ticketing/contracts/index.ts";
export class PostgresOnlineEligibility implements OnlineEligibility {
  constructor(
    private occurrences: TicketOccurrences,
    private tickets: TicketReader,
  ) {}
  async authorize(
    tx: Transaction,
    owner: string,
    order: string,
    occurrence: string,
  ) {
    const row = (
      await tx.query(
        "SELECT state FROM bookings.orders WHERE id=$1 AND owner_id=$2 FOR SHARE",
        [order, owner],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Booking not found.", 404);
    if (row.state !== "confirmed")
      throw new AppError(
        "ONLINE_ACCESS_DENIED",
        "A confirmed booking is required.",
        409,
      );
    const scheduled = (await this.occurrences.read(tx, [occurrence]))[0];
    if (!scheduled || scheduled.state !== "open")
      throw new AppError(
        "ONLINE_ACCESS_DENIED",
        "This session is not available for online access.",
        409,
      );
    const tickets = await this.tickets.list(owner, order, tx, []);
    if (
      !tickets.some(
        (t) =>
          t.occurrenceId === occurrence &&
          t.state === "valid" &&
          t.remaining > 0,
      )
    )
      throw new AppError(
        "ONLINE_ACCESS_DENIED",
        "An active unused ticket for this session is required.",
        403,
      );
  }
}
