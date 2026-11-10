import type { Transaction } from "../../../shared/database.ts";
export interface AdminActivityReader {
  read(
    tx: Transaction,
    actor: string,
    target: string,
    after?: string,
  ): Promise<unknown>;
}
