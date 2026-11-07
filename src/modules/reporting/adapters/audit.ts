import { pool, type Transaction } from "../../../shared/database.ts";
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
  async list() {
    return (
      await pool.query(
        "SELECT id,actor_id,action,target,details,created_at FROM reporting.audit ORDER BY id DESC LIMIT 100",
      )
    ).rows;
  }
}
