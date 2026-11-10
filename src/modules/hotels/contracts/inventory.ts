import type { Transaction } from "../../../shared/database.ts";
export interface HotelInventoryTarget {
  lock(tx: Transaction, id: string): Promise<{ state: string }>;
}
