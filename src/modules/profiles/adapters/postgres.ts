import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { ProfileInput, ProfileStore } from "../application/profile.ts";
export class PostgresProfiles implements ProfileStore {
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
  async save(id: string, input: ProfileInput) {
    return transaction(async (tx) => {
      await tx.query(
        "INSERT INTO profiles.preferences(account_id,version) VALUES($1,0) ON CONFLICT DO NOTHING",
        [id],
      );
      const current = (
        await tx.query(
          "SELECT name,theme,city,version FROM profiles.preferences WHERE account_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (current.version !== input.expectedVersion) {
        if (
          current.version === input.expectedVersion + 1 &&
          current.name === input.name &&
          current.theme === input.theme &&
          current.city === input.city
        )
          return current;
        throw new AppError(
          "VERSION_CONFLICT",
          "Your profile changed elsewhere. Load the latest profile and review before saving again.",
          409,
        );
      }
      return (
        await tx.query(
          "UPDATE profiles.preferences SET name=$2,theme=$3,city=$4,version=version+1 WHERE account_id=$1 RETURNING name,theme,city,version",
          [id, input.name, input.theme, input.city],
        )
      ).rows[0];
    });
  }
}
