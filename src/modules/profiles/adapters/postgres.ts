import { pool } from "../../../shared/database.ts";
export class PostgresProfiles {
  async get(id: string) {
    return (
      (
        await pool.query(
          "SELECT name,theme,city,version FROM profiles.preferences WHERE account_id=$1",
          [id],
        )
      ).rows[0] ?? { name: "", theme: "LIGHT", city: null, version: 0 }
    );
  }
  async save(
    id: string,
    input: { name: string; theme: "LIGHT" | "DARK"; city: string | null },
  ) {
    return (
      await pool.query(
        "INSERT INTO profiles.preferences(account_id,name,theme,city) VALUES($1,$2,$3,$4) ON CONFLICT(account_id) DO UPDATE SET name=$2,theme=$3,city=$4,version=profiles.preferences.version+1 RETURNING name,theme,city,version",
        [id, input.name, input.theme, input.city],
      )
    ).rows[0];
  }
}
