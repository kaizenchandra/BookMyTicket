import type { Transaction } from "../../../shared/database.ts";
import type {
  PaymentHistory,
  PaymentHistorySelection,
} from "../../payments/contracts/history.ts";
export interface PaymentHistoryOwner {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  get(owner: string, id: string, tx: Transaction): Promise<unknown>;
}
export class BookingPaymentHistory {
  constructor(
    private bookings: PaymentHistoryOwner,
    private payments: PaymentHistory,
  ) {}
  get(
    owner: string,
    id: string,
    after?: string,
    selection?: PaymentHistorySelection,
  ) {
    return this.bookings.unitOfWork(async (tx) => {
      await this.bookings.get(owner, id, tx);
      return this.payments.read(tx, id, after, selection);
    });
  }
}
