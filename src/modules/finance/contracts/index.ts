import type { Transaction } from "../../../shared/database.ts";
export interface Ledger {
  collection(
    tx: Transaction,
    eventId: string,
    amountPaise: number,
    liability: "customer_booking_liability" | "customer_refund_liability",
  ): Promise<void>;
}
