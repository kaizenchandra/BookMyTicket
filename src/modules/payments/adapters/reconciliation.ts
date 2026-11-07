import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import type { Collection } from "../application/collection.ts";
export class PaymentReconciliation {
  constructor(private collection: Collection) {}
  async once() {
    if (!this.collection.available()) return false;
    const token = randomUUID();
    const record = await transaction(async (tx) => {
      const r = (
        await tx.query(
          "SELECT order_id FROM payments.provider_orders WHERE NOT review_required AND available_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp()) ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!r) return null;
      await tx.query(
        "UPDATE payments.provider_orders SET lease_token=$2,lease_until=clock_timestamp()+interval '60 seconds' WHERE order_id=$1",
        [r.order_id, token],
      );
      return r;
    });
    if (!record) return false;
    try {
      await this.collection.reconcileOrder(record.order_id);
      await pool.query(
        "UPDATE payments.provider_orders SET checked_at=clock_timestamp(),failures=0,last_error_code=NULL,available_at=clock_timestamp()+interval '60 seconds',lease_until=NULL,review_required=created_at<clock_timestamp()-interval '7 days' WHERE order_id=$1 AND lease_token=$2 AND lease_until>clock_timestamp()",
        [record.order_id, token],
      );
    } catch (error) {
      await pool.query(
        "UPDATE payments.provider_orders SET failures=failures+1,review_required=failures>=7,last_error_code=$3,available_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(failures,7)))::int),lease_until=NULL WHERE order_id=$1 AND lease_token=$2 AND lease_until>clock_timestamp()",
        [
          record.order_id,
          token,
          (error as { code?: string }).code ?? "RECONCILIATION_FAILED",
        ],
      );
    }
    return true;
  }
}
