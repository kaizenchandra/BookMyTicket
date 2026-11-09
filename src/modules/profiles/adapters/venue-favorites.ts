import { pool } from "../../../shared/database.ts";
import type { VenueFavoritesStore } from "../application/venue-favorites.ts";
export class PostgresVenueFavorites implements VenueFavoritesStore {
  async save(owner: string, venue: string) {
    await pool.query(
      "INSERT INTO profiles.venue_favorites(account_id,venue_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [owner, venue],
    );
  }
  async remove(owner: string, venue: string) {
    await pool.query(
      "DELETE FROM profiles.venue_favorites WHERE account_id=$1 AND venue_id=$2",
      [owner, venue],
    );
  }
  async has(owner: string, venue: string) {
    return Boolean(
      (
        await pool.query(
          "SELECT 1 FROM profiles.venue_favorites WHERE account_id=$1 AND venue_id=$2",
          [owner, venue],
        )
      ).rowCount,
    );
  }
  async page(owner: string, after?: string) {
    return (
      await pool.query(
        "SELECT venue_id,created_at FROM profiles.venue_favorites WHERE account_id=$1 AND ($2::uuid IS NULL OR venue_id>$2) ORDER BY venue_id LIMIT 25",
        [owner, after ?? null],
      )
    ).rows;
  }
}
