import type { Transaction } from "../../../shared/database.ts";
export const paymentMilestoneKinds = [
  "capture_recorded",
  "recovery_recorded",
  "attempt_created",
  "attempt_authorized",
  "attempt_captured",
  "attempt_refunded",
  "attempt_failed",
] as const;
export type PaymentMilestone = {
  id: string;
  kind: (typeof paymentMilestoneKinds)[number];
  attemptId?: string | null;
  occurredAt: string;
  amountPaise: number;
  currency: "INR";
};
export type PaymentHistoryPage = {
  items: PaymentMilestone[];
  nextCursor: string | null;
};
export const paymentHistoryCategories = [
  "all",
  "captures",
  "recovery",
  "attempts",
] as const;
export type PaymentHistorySelection = {
  category?: (typeof paymentHistoryCategories)[number];
  attemptId?: string;
};
export interface PaymentHistory {
  read(
    tx: Transaction,
    booking: string,
    after?: string,
    selection?: PaymentHistorySelection,
  ): Promise<PaymentHistoryPage>;
}
