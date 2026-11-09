import { type Transaction } from "../../../shared/database.ts";
export class PostgresAudit {
  async record(
    tx: Transaction,
    actorId: string,
    action: string,
    target: string,
    details: Record<string, unknown>,
  ) {
    await tx.query(
      "INSERT INTO reporting.audit(actor_id,action,target,details) VALUES($1,$2,$3,$4)",
      [actorId, action, target, details],
    );
  }
}
