import type { Transaction } from "../../../shared/database.ts";
import type { CustomerProfiles } from "../../../shared/customer-admin.ts";
import { PostgresSavedAttendees } from "./saved-attendees.ts";
export class PostgresCustomerProfiles implements CustomerProfiles {
  async match(tx: Transaction, q: string) {
    return (
      await tx.query(
        "SELECT account_id FROM profiles.preferences WHERE name ILIKE '%'||$1||'%'",
        [q.replace(/[\\%_]/g, "\\$&")],
      )
    ).rows.map((r) => r.account_id);
  }
  async summaries(tx: Transaction, ids: string[]) {
    return Object.fromEntries(
      (
        await tx.query(
          "SELECT account_id,name,city FROM profiles.preferences WHERE account_id=ANY($1::uuid[])",
          [ids],
        )
      ).rows.map(({ account_id, ...p }) => [account_id, p]),
    );
  }
  async detail(tx: Transaction, id: string) {
    const profile = (
      await tx.query(
        "SELECT name,city,theme,version FROM profiles.preferences WHERE account_id=$1",
        [id],
      )
    ).rows[0] ?? { name: "", city: null, theme: "LIGHT", version: 0 };
    return {
      ...profile,
      savedAttendees:
        await new PostgresSavedAttendees().maskedForAdministration(tx, id),
      wallet: { supported: false },
      loyalty: { supported: false },
    };
  }
}
