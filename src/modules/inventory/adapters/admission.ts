import type { Transaction } from "../../../shared/database.ts";
import type { AdmissionWindow } from "../contracts/index.ts";
export class PostgresAdmissionWindow implements AdmissionWindow {
  async check(
    tx: Transaction,
    id: string,
  ): Promise<"open" | "wrong_time" | "cancelled"> {
    const r = (
      await tx.query(
        "SELECT state,clock_timestamp() BETWEEN starts_at-interval '1 hour' AND ends_at AS within_window FROM inventory.occurrences WHERE id=$1 FOR UPDATE",
        [id],
      )
    ).rows[0];
    if (!r || r.state === "cancelled") return "cancelled";
    return r.within_window ? "open" : "wrong_time";
  }
}
