import type {
  PaymentOrderAccess,
  PayableOrder,
} from "../../payments/contracts/payment-order.ts";
import type { InventoryCommerce } from "../../inventory/contracts/index.ts";
import type { QuoteAcceptance } from "../../pricing/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export interface PaymentOrderStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  lock(tx: Transaction, id: string): Promise<PayableOrder | undefined>;
  get(ownerId: string, id: string): Promise<PayableOrder>;
}
export class PaymentOrders implements PaymentOrderAccess {
  constructor(
    private store: PaymentOrderStore,
    private inventory: InventoryCommerce,
    private quotes: QuoteAcceptance,
  ) {}
  owned(ownerId: string, id: string) {
    return this.store.get(ownerId, id);
  }
  prepare<T>(
    ownerId: string,
    id: string,
    stage: (tx: Transaction, order: PayableOrder) => Promise<T>,
  ) {
    return this.store.unitOfWork(async (tx) => {
      const order = await this.store.lock(tx, id);
      if (!order || order.owner_id !== ownerId)
        throw new AppError("NOT_FOUND", "Booking not found.", 404);
      if (order.state !== "pending_payment")
        throw new AppError(
          "PAYMENT_NOT_ALLOWED",
          "This booking cannot accept a new payment.",
          409,
        );
      const snapshot = await this.inventory.snapshot(
        tx,
        ownerId,
        order.reservation_id,
      );
      if (snapshot.occurrences.some((o) => o.isDemo))
        throw new AppError(
          "DEMO_PAYMENT_DISABLED",
          "Demo shows cannot collect real payments. Choose a free demo session.",
          409,
        );
      const quote = await this.quotes.accept(
        tx,
        ownerId,
        order.reservation_id,
        order.quote_id,
        snapshot,
      );
      if (
        quote.prices.totalPaise !== order.amount_paise ||
        order.currency !== "INR"
      )
        throw new AppError(
          "QUOTE_CHANGED",
          "Accepted price no longer matches.",
          409,
        );
      if (order.amount_paise <= 0)
        throw new AppError(
          "FREE_BOOKING_REQUIRED",
          "Free bookings require a separate authorized confirmation.",
          409,
        );
      return stage(tx, order);
    });
  }
}
