import { randomUUID } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import type { Captures, CapturedPayment } from "../contracts/index.ts";
export class PostgresCaptures implements Captures {
  async record(tx: Transaction, p: CapturedPayment) {
    return (
      (
        await tx.query(
          "INSERT INTO payments.captures(provider_payment_id,order_id,amount_paise,currency) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING provider_payment_id",
          [p.id, p.orderId, p.amountPaise, p.currency],
        )
      ).rowCount === 1
    );
  }
  async recovery(tx: Transaction, p: CapturedPayment, reason: string) {
    await tx.query(
      "INSERT INTO payments.recovery(id,order_id,provider_payment_id,reason,amount_paise) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_payment_id) DO NOTHING",
      [randomUUID(), p.orderId, p.id, reason, p.amountPaise],
    );
  }
}
