import { AppError } from "../../../shared/errors.ts";
import { pool, transaction } from "../../../shared/database.ts";
import type { DurableConsumer, DurableRecord } from "../contracts/index.ts";
export class PostgresConsumer implements DurableConsumer {
  async failures() {
    return (
      await pool.query(
        "SELECT event_id,attempts,last_error_code,available_at FROM reporting.deliveries WHERE consumer='customer-inbox-v1' AND state='dead' ORDER BY available_at DESC LIMIT 100",
      )
    ).rows;
  }
  async replay(actor: string, id: string, reason: string) {
    return transaction(async (tx) => {
      const r = await tx.query(
        "UPDATE reporting.deliveries SET state='pending',attempts=0,available_at=clock_timestamp(),last_error_code=NULL WHERE consumer='customer-inbox-v1' AND event_id=$1 AND state='dead' RETURNING event_id",
        [id],
      );
      if (!r.rowCount)
        throw new AppError(
          "CONFLICT",
          "Delivery is not awaiting replay. Refresh its status.",
        );
      await tx.query(
        "INSERT INTO reporting.audit(actor_id,action,target,details) VALUES($1,'notifications.delivery.replay',$2,$3)",
        [actor, id, { reason }],
      );
      return { eventId: id, state: "pending" };
    });
  }
  async once(
    consumer: string,
    types: string[],
    handle: Parameters<DurableConsumer["once"]>[2],
  ) {
    return transaction(async (tx) => {
      // Each consumer has independent delivery state; adding a consumer never steals another's events.
      await tx.query(
        "INSERT INTO reporting.deliveries(event_id,consumer) SELECT o.id,$1 FROM reporting.outbox o WHERE o.type=ANY($2::text[]) AND NOT EXISTS(SELECT 1 FROM reporting.deliveries d WHERE d.event_id=o.id AND d.consumer=$1) ORDER BY o.created_at,o.id LIMIT 100 ON CONFLICT DO NOTHING",
        [consumer, types],
      );
      const row = (
        await tx.query(
          "SELECT o.id,o.type,o.aggregate_id,o.payload,o.created_at,d.attempts FROM reporting.deliveries d JOIN reporting.outbox o ON o.id=d.event_id WHERE d.consumer=$1 AND d.state='pending' AND d.available_at<=clock_timestamp() ORDER BY d.available_at,d.event_id FOR UPDATE OF d SKIP LOCKED LIMIT 1",
          [consumer],
        )
      ).rows[0] as (DurableRecord & { attempts: number }) | undefined;
      if (!row) return false;
      await tx.query("SAVEPOINT delivery_attempt");
      try {
        await handle(tx, row);
        await tx.query(
          "UPDATE reporting.deliveries SET state='done',attempts=attempts+1,completed_at=clock_timestamp(),last_error_code=NULL WHERE event_id=$1 AND consumer=$2",
          [row.id, consumer],
        );
      } catch {
        await tx.query("ROLLBACK TO SAVEPOINT delivery_attempt");
        await tx.query(
          "UPDATE reporting.deliveries SET attempts=attempts+1,state=CASE WHEN attempts+1>=5 THEN 'dead' ELSE 'pending' END,available_at=clock_timestamp()+($3::int * interval '1 second'),last_error_code='CONSUMER_FAILED' WHERE event_id=$1 AND consumer=$2",
          [row.id, consumer, Math.min(300, 2 ** (row.attempts + 1))],
        );
      }
      return true;
    });
  }
}
