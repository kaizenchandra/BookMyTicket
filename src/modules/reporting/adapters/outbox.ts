import { randomUUID } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import type { DurableEvents } from "../contracts/index.ts";
export class PostgresEvents implements DurableEvents {
  async publish(
    tx: Transaction,
    type: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ) {
    await tx.query(
      "INSERT INTO reporting.outbox(id,type,aggregate_id,payload) VALUES($1,$2,$3,$4)",
      [randomUUID(), type, aggregateId, { version: 1, ...payload }],
    );
  }
}
