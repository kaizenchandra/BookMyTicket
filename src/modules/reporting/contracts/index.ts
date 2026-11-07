import type { Transaction } from "../../../shared/database.ts";
export interface DurableEvents {
  publish(
    tx: Transaction,
    type: string,
    aggregateId: string,
    payload: Record<string, unknown>,
  ): Promise<void>;
}
export interface SecurityAudit {
  record(
    tx: Transaction,
    actorId: string,
    action: string,
    target: string,
    details: Record<string, unknown>,
  ): Promise<void>;
}

export type DurableRecord = {
  id: string;
  type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
};
export interface DurableConsumer {
  once(
    consumer: string,
    types: string[],
    handle: (tx: Transaction, event: DurableRecord) => Promise<void>,
  ): Promise<boolean>;
}
