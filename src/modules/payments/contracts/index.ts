import type { Transaction } from "../../../shared/database.ts";
export type CapturedPayment = {
  id: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
};
export interface Captures {
  record(tx: Transaction, payment: CapturedPayment): Promise<boolean>;
  recovery(
    tx: Transaction,
    payment: CapturedPayment,
    reason: string,
  ): Promise<void>;
}

export interface CancellationPaymentStatus {
  pendingCancellation(
    tx: Transaction,
    orderId: string,
  ): Promise<{
    paymentActivity: boolean;
    recovery: { amountPaise: number; state: string; reason: string }[];
  }>;
}
