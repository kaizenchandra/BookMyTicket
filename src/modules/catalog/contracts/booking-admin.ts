import type { Transaction } from "../../../shared/database.ts";
export interface BookingCatalog {
  match(
    tx: Transaction,
    filters: { product?: string; supplier?: string },
  ): Promise<string[] | null>;
}
