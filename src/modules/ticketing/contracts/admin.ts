import type { Transaction } from "../../../shared/database.ts";
export interface AdminFulfillment {
  summary(
    tx: Transaction,
    booking: string,
  ): Promise<{ state: string; count: string }[]>;
}
