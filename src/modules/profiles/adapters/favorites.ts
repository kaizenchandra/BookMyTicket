import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import type { FavoritesStore } from "../application/favorites.ts";
export class PostgresFavorites implements FavoritesStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async save(tx: Transaction, owner: string, listing: string) {
    await tx.query(
      "INSERT INTO profiles.favorites(account_id,listing_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [owner, listing],
    );
  }
  async remove(owner: string, listing: string) {
    await pool.query(
      "DELETE FROM profiles.favorites WHERE account_id=$1 AND listing_id=$2",
      [owner, listing],
    );
  }
  async has(owner: string, listing: string) {
    return !!(
      await pool.query(
        "SELECT 1 FROM profiles.favorites WHERE account_id=$1 AND listing_id=$2",
        [owner, listing],
      )
    ).rowCount;
  }
  async page(owner: string, after?: string) {
    return (
      await pool.query(
        "SELECT listing_id,created_at FROM profiles.favorites WHERE account_id=$1 AND ($2::uuid IS NULL OR listing_id>$2) ORDER BY listing_id LIMIT 25",
        [owner, after ?? null],
      )
    ).rows;
  }
}
