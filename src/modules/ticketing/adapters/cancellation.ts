import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { UnusedTicketCancellation } from "../contracts/index.ts";
export class PostgresUnusedTickets implements UnusedTicketCancellation {
  async inspect(tx: Transaction, order: string, quantity: number) {
    const rows = (
      await tx.query(
        "SELECT id,state,remaining FROM ticketing.tickets WHERE order_id=$1 ORDER BY id FOR UPDATE",
        [order],
      )
    ).rows;
    if (
      rows.length !== quantity ||
      !quantity ||
      rows.some((r) => r.state !== "valid" || r.remaining !== 1)
    )
      throw new AppError(
        "TICKETS_NOT_CANCELLABLE",
        "All tickets must be valid, unused and not transferred to cancel this booking.",
        409,
      );
    return rows.map((r) => r.id);
  }
  async revoke(tx: Transaction, ids: string[]) {
    const result = await tx.query(
      "UPDATE ticketing.tickets SET state='revoked' WHERE id=ANY($1::uuid[]) AND state='valid' AND remaining=1",
      [ids],
    );
    if (result.rowCount !== ids.length)
      throw new AppError("TICKET_CONFLICT", "Ticket validity changed.", 409);
  }
}
