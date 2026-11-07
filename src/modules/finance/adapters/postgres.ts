import { randomUUID } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import type { Ledger } from "../contracts/index.ts";
export class PostgresLedger implements Ledger {
  async collection(
    tx: Transaction,
    eventId: string,
    amount: number,
    liability: "customer_booking_liability" | "customer_refund_liability",
  ) {
    const id = randomUUID();
    const inserted = await tx.query(
      "INSERT INTO finance.journals(id,event_id) VALUES($1,$2) ON CONFLICT(event_id) DO NOTHING RETURNING id",
      [id, eventId],
    );
    if (!inserted.rowCount) return;
    await tx.query(
      "INSERT INTO finance.lines(journal_id,account,amount_paise,currency) VALUES($1,'razorpay_receivable',$2,'INR'),($1,$3,-$2,'INR')",
      [id, amount, liability],
    );
  }
}
