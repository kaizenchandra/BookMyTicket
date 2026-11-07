import type { InventoryCommerce } from "../../inventory/contracts/index.ts";
import type {
  Captures,
  CapturedPayment,
} from "../../payments/contracts/index.ts";
import type { TicketIssuer } from "../../ticketing/contracts/index.ts";
import type { Ledger } from "../../finance/contracts/index.ts";
import type { DurableEvents } from "../../reporting/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export interface BookingStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  lock(tx: Transaction, id: string): Promise<any>;
  confirm(tx: Transaction, id: string, paymentId: string): Promise<void>;
  recovery(tx: Transaction, id: string): Promise<void>;
}
export class Checkout {
  constructor(
    private store: BookingStore,
    private inventory: InventoryCommerce,
    private captures: Captures,
    private tickets: TicketIssuer,
    private ledger: Ledger,
    private events: DurableEvents,
  ) {}
  // Only trusted provider reconciliation invokes this use case; never exposed as a browser command.
  captured(payment: CapturedPayment) {
    return this.store.unitOfWork(async (tx) => {
      const order = await this.store.lock(tx, payment.orderId);
      if (!order) throw new AppError("NOT_FOUND", "Order not found.", 404);
      if (!(await this.captures.record(tx, payment)))
        return { state: order.state, duplicateEvent: true };
      let reason: string | null = null;
      if (
        payment.amountPaise !== order.amount_paise ||
        payment.currency !== order.currency
      )
        reason = "amount_or_currency_mismatch";
      else if (order.state === "confirmed") reason = "duplicate_capture";
      else if (order.state === "cancelled" || order.state === "refund_required")
        reason = "order_not_fulfillable";
      else if (
        !(await this.inventory.consume(
          tx,
          order.owner_id,
          order.reservation_id,
        ))
      )
        reason = "inventory_unavailable";
      if (reason) {
        await this.captures.recovery(tx, payment, reason);
        await this.ledger.collection(
          tx,
          payment.id,
          payment.amountPaise,
          "customer_refund_liability",
        );
        if (order.state === "pending_payment")
          await this.store.recovery(tx, order.id);
        await this.events.publish(tx, "payment.recovery_required", order.id, {
          reason,
          ownerId: order.owner_id,
          paymentId: payment.id,
        });
        return {
          state: ["confirmed", "cancelled"].includes(order.state)
            ? order.state
            : "refund_required",
          recovery: reason,
        };
      }
      await this.store.confirm(tx, order.id, payment.id);
      await this.tickets.issue(
        tx,
        order.id,
        order.owner_id,
        order.snapshot.items,
      );
      await this.ledger.collection(
        tx,
        payment.id,
        payment.amountPaise,
        "customer_booking_liability",
      );
      await this.events.publish(tx, "booking.confirmed", order.id, {
        ownerId: order.owner_id,
      });
      return { state: "confirmed" };
    });
  }
}
