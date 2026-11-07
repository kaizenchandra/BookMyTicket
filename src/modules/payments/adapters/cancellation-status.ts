import type { Transaction } from "../../../shared/database.ts";
import type { CancellationPaymentStatus } from "../contracts/index.ts";
export class PostgresCancellationPaymentStatus implements CancellationPaymentStatus {
  async pendingCancellation(tx: Transaction, id: string) {
    const activity = (
      await tx.query(
        "SELECT EXISTS(SELECT 1 FROM payments.provider_orders WHERE order_id=$1) OR EXISTS(SELECT 1 FROM payments.captures WHERE order_id=$1) OR EXISTS(SELECT 1 FROM payments.attempts WHERE order_id=$1) AS present",
        [id],
      )
    ).rows[0].present;
    const recovery = (
      await tx.query(
        'SELECT amount_paise AS "amountPaise",state,reason FROM payments.recovery WHERE order_id=$1 ORDER BY created_at,id',
        [id],
      )
    ).rows;
    return { paymentActivity: activity, recovery };
  }
}
