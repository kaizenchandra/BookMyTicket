import { databaseConfig } from "./config.ts";
import pg from "pg";
export const pool = new pg.Pool({
  ...databaseConfig(),
  max: 20,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
});
export type Transaction = pg.PoolClient;
export async function transaction<T>(
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const tx = await pool.connect();
    try {
      await tx.query("BEGIN");
      const value = await work(tx);
      await tx.query("COMMIT");
      return value;
    } catch (error) {
      await tx.query("ROLLBACK");
      if (
        attempt < 2 &&
        ["40001", "40P01"].includes((error as { code: string }).code)
      )
        continue;
      throw error;
    } finally {
      tx.release();
    }
  }
}
