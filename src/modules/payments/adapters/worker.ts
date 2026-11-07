import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import type { Collection } from "../application/collection.ts";
export class WebhookWorker {
  constructor(private collection: Collection) {}
  async once() {
    const token = randomUUID();
    const event = await transaction(async (tx) => {
      const r = (
        await tx.query(
          "SELECT * FROM payments.webhook_events WHERE state IN ('pending','processing') AND available_at<=clock_timestamp() AND (lease_until IS NULL OR lease_until<clock_timestamp()) ORDER BY received_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!r) return null;
      await tx.query(
        "UPDATE payments.webhook_events SET state='processing',lease_token=$2,lease_until=clock_timestamp()+interval '60 seconds',attempts=attempts+1 WHERE provider_event_id=$1",
        [r.provider_event_id, token],
      );
      return r;
    });
    if (!event) return false;
    try {
      const paymentId = event.body.payload?.payment?.entity?.id;
      if (!paymentId)
        throw Object.assign(new Error("Unsupported webhook requires review"), {
          code: "UNSUPPORTED_EVENT",
        });
      await this.collection.reconcile(paymentId);
      await pool.query(
        "UPDATE payments.webhook_events SET state='done',lease_until=NULL WHERE provider_event_id=$1 AND lease_token=$2 AND lease_until>clock_timestamp()",
        [event.provider_event_id, token],
      );
    } catch (error) {
      await pool.query(
        "UPDATE payments.webhook_events SET state=CASE WHEN attempts>=8 THEN 'dead_letter' ELSE 'pending' END,lease_until=NULL,available_at=clock_timestamp()+make_interval(secs=>least(3600, power(2,attempts)::int)),last_error_code=$3 WHERE provider_event_id=$1 AND lease_token=$2 AND lease_until>clock_timestamp()",
        [
          event.provider_event_id,
          token,
          (error as { code?: string }).code ?? "PROCESSING_FAILED",
        ],
      );
    }
    return true;
  }
}
