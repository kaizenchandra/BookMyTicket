import type { Transaction } from "../../../shared/database.ts";
export interface SupportBookingReader {
  readOwned(
    tx: Transaction,
    owner: string,
    id: string,
  ): Promise<{
    id: string;
    state: string;
    amountPaise: number;
    currency: string;
    createdAt: Date;
  }>;
}
