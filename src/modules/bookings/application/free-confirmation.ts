import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { BookingStore } from "./checkout.ts";
import type { InventoryCommerce } from "../../inventory/contracts/index.ts";
import type { TicketIssuer } from "../../ticketing/contracts/index.ts";
import type {
  DurableEvents,
  SecurityAudit,
} from "../../reporting/contracts/index.ts";
export interface FreeBookingStore extends BookingStore {
  serializeFree(tx: Transaction, owner: string): Promise<void>;
  priorFree(
    tx: Transaction,
    owner: string,
    key: string,
  ): Promise<string | null>;
  isFreeConfirmed(tx: Transaction, id: string): Promise<boolean>;
  confirmFree(tx: Transaction, owner: string, id: string): Promise<void>;
  recordFreeCommand(
    tx: Transaction,
    owner: string,
    key: string,
    id: string,
  ): Promise<void>;
}
export class FreeConfirmation {
  constructor(
    private store: FreeBookingStore,
    private inventory: InventoryCommerce,
    private tickets: TicketIssuer,
    private events: DurableEvents,
    private audit: SecurityAudit,
  ) {}
  confirm(owner: string, id: string, key: string) {
    return this.store.unitOfWork(async (tx) => {
      await this.store.serializeFree(tx, owner);
      const prior = await this.store.priorFree(tx, owner, key);
      if (prior && prior !== id)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Confirmation key was used for another order.",
          409,
        );
      const order = await this.store.lock(tx, id);
      if (!order || order.owner_id !== owner)
        throw new AppError("NOT_FOUND", "Order not found.", 404);
      if (order.amount_paise !== 0 || order.currency !== "INR")
        throw new AppError(
          "PAYMENT_REQUIRED",
          "This order requires payment.",
          409,
        );
      if (await this.store.isFreeConfirmed(tx, id)) {
        if (!prior) await this.store.recordFreeCommand(tx, owner, key, id);
        return {
          orderId: id,
          bookingState: order.state,
          paymentState: "not_required",
        };
      }
      if (order.state !== "pending_payment")
        throw new AppError(
          "CONFIRMATION_NOT_ALLOWED",
          "This order cannot be confirmed.",
          409,
        );
      if (
        !order.accepted_at ||
        !order.quote_id ||
        order.snapshot?.quote?.prices?.totalPaise !== 0
      )
        throw new AppError(
          "ACCEPTED_QUOTE_REQUIRED",
          "An accepted zero-total quote is required.",
          409,
        );
      if (order.snapshot.quote.policy?.allowFreeBookings !== true)
        throw new AppError(
          "FREE_BOOKING_NOT_ALLOWED",
          "The accepted policy does not authorize free bookings.",
          409,
        );
      // Unlike paid late-success recovery, free confirmation never reacquires an expired reservation.
      await this.inventory.snapshot(tx, owner, order.reservation_id);
      if (
        !(await this.inventory.consume(tx, owner, order.reservation_id, {
          requireActive: true,
        }))
      )
        throw new AppError(
          "INVENTORY_UNAVAILABLE",
          "Your reservation cannot be confirmed.",
          409,
        );
      await this.store.confirmFree(tx, owner, id);
      await this.tickets.issue(tx, id, owner, order.snapshot.items);
      await this.events.publish(tx, "booking.confirmed", id, {
        ownerId: owner,
      });
      await this.audit.record(tx, owner, "booking.free_confirmed", id, {
        amountPaise: 0,
        currency: "INR",
      });
      await this.store.recordFreeCommand(tx, owner, key, id);
      return {
        orderId: id,
        bookingState: "confirmed",
        paymentState: "not_required",
      };
    });
  }
}
