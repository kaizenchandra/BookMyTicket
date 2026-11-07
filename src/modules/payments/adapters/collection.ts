import { pool, type Transaction } from "../../../shared/database.ts";
import type { CollectionStore } from "../application/collection.ts";
import type { ProviderPayment } from "../application/provider.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresCollection implements CollectionStore {
  async prepare(tx: Transaction, orderId: string, amount: number) {
    const inserted = await tx.query(
      "INSERT INTO payments.provider_orders(order_id,amount_paise,state,available_at) VALUES($1,$2,'creating',clock_timestamp()+interval '30 seconds') ON CONFLICT DO NOTHING RETURNING *",
      [orderId, amount],
    );
    const row =
      inserted.rows[0] ??
      (
        await tx.query(
          "SELECT * FROM payments.provider_orders WHERE order_id=$1",
          [orderId],
        )
      ).rows[0];
    if (row.amount_paise !== amount)
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Stored payment amount differs.",
        409,
      );
    return { ...row, newAttempt: inserted.rowCount === 1 };
  }
  async get(orderId: string) {
    return (
      await pool.query(
        `SELECT p.*,(SELECT count(*)>0 AND bool_and(state='failed') AND string_agg(provider_payment_id,',' ORDER BY provider_payment_id) IS DISTINCT FROM p.retry_watermark FROM payments.attempts WHERE order_id=p.order_id) retry_eligible FROM payments.provider_orders p WHERE p.order_id=$1`,
        [orderId],
      )
    ).rows[0];
  }
  async created(orderId: string, providerId: string) {
    const r = await pool.query(
      "UPDATE payments.provider_orders SET provider_id=$2,state='ready' WHERE order_id=$1 AND (provider_id IS NULL OR provider_id=$2)",
      [orderId, providerId],
    );
    if (r.rowCount !== 1)
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Conflicting provider order mapping.",
        409,
      );
  }
  async unknown(orderId: string) {
    await pool.query(
      "UPDATE payments.provider_orders SET state='unknown' WHERE order_id=$1 AND provider_id IS NULL",
      [orderId],
    );
  }
  async findByProviderId(providerId: string) {
    return (
      await pool.query(
        "SELECT order_id,amount_paise FROM payments.provider_orders WHERE provider_id=$1",
        [providerId],
      )
    ).rows[0];
  }
  async observe(orderId: string, payment: ProviderPayment) {
    const r = await pool.query(
      `INSERT INTO payments.attempts(provider_payment_id,order_id,amount_paise,currency,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(provider_payment_id) DO UPDATE SET state=CASE WHEN payments.attempts.state='refunded' THEN 'refunded' WHEN payments.attempts.state='captured' AND EXCLUDED.state<>'refunded' THEN 'captured' WHEN EXCLUDED.state='created' THEN payments.attempts.state ELSE EXCLUDED.state END,observed_at=clock_timestamp() WHERE payments.attempts.order_id=EXCLUDED.order_id AND payments.attempts.amount_paise=EXCLUDED.amount_paise AND payments.attempts.currency=EXCLUDED.currency RETURNING state`,
      [payment.id, orderId, payment.amount, payment.currency, payment.status],
    );
    if (r.rowCount !== 1)
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Payment observation conflicts with its recorded association.",
        409,
      );
    return r.rows[0].state as string;
  }
  async claimRetry(tx: Transaction, orderId: string) {
    const record = (
      await tx.query(
        "SELECT * FROM payments.provider_orders WHERE order_id=$1 FOR UPDATE",
        [orderId],
      )
    ).rows[0];
    const attempts = (
      await tx.query(
        "SELECT provider_payment_id,state FROM payments.attempts WHERE order_id=$1 ORDER BY provider_payment_id",
        [orderId],
      )
    ).rows;
    const watermark = attempts.map((a) => a.provider_payment_id).join(",");
    if (
      record.review_required ||
      !attempts.length ||
      attempts.some((a) => a.state !== "failed") ||
      record.retry_watermark === watermark
    )
      throw new AppError(
        "PAYMENT_RECONCILING",
        "The previous payment is unresolved. Do not pay again until its status is known.",
        409,
      );
    await tx.query(
      "UPDATE payments.provider_orders SET retry_watermark=$2 WHERE order_id=$1",
      [orderId, watermark],
    );
  }
  async summary(orderId: string) {
    return (
      await pool.query(
        "SELECT state,amount_paise,currency,observed_at FROM payments.attempts WHERE order_id=$1 ORDER BY observed_at DESC LIMIT 20",
        [orderId],
      )
    ).rows;
  }
}
