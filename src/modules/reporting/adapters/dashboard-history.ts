import { randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export class DashboardHistory {
  transaction<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      return work(tx);
    });
  }
  async now(tx: Transaction) {
    return (await tx.query("SELECT transaction_timestamp() AS now")).rows[0]
      .now as Date;
  }

  async save(
    tx: Transaction,
    actor: string,
    filters: unknown,
    report: unknown,
  ) {
    const id = randomUUID();
    await tx.query(
      "INSERT INTO reporting.dashboard_snapshots(id,actor_id,definition_version,filters,report) VALUES($1,$2,'2',$3,$4)",
      [id, actor, filters, report],
    );
    return id;
  }
  async list(tx: Transaction) {
    return {
      items: (
        await tx.query(
          "SELECT id,created_at,definition_version,filters FROM reporting.dashboard_snapshots ORDER BY created_at DESC,id DESC LIMIT 20",
        )
      ).rows,
    };
  }
  async get(tx: Transaction, id: string) {
    const result = await tx.query(
      "SELECT report,definition_version FROM reporting.dashboard_snapshots WHERE id=$1",
      [id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Historical dashboard not found.", 404);
    return {
      ...result.rows[0].report,
      snapshotId: id,
      historical: true,
      definitionVersion: result.rows[0].definition_version,
    };
  }
}
