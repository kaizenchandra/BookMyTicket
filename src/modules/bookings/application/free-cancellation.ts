import { createHash } from "node:crypto";
import { AppError } from "../../../shared/errors.ts";
import type { Transaction } from "../../../shared/database.ts";
import type { FreeCancellationInventory } from "../../inventory/contracts/index.ts";
import type { UnusedTicketCancellation } from "../../ticketing/contracts/index.ts";
import type {
  DurableEvents,
  SecurityAudit,
} from "../../reporting/contracts/index.ts";
export type FreeCancelInput = {
  previewId: string;
  reason: string;
  confirm: true;
};
export interface FreeCancellationStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  serialize(tx: Transaction, owner: string): Promise<void>;
  lock(tx: Transaction, owner: string, id: string): Promise<any>;
  preview(
    tx: Transaction,
    owner: string,
    id: string,
    fingerprint: string,
    expiry: Date,
  ): Promise<string>;
  validate(
    tx: Transaction,
    owner: string,
    id: string,
    preview: string,
    fingerprint: string,
  ): Promise<void>;
  prior(
    tx: Transaction,
    owner: string,
    key: string,
    fingerprint: string,
  ): Promise<boolean>;
  cancelled(tx: Transaction, id: string): Promise<boolean>;
  finish(
    tx: Transaction,
    owner: string,
    id: string,
    reason: string,
  ): Promise<void>;
  command(
    tx: Transaction,
    owner: string,
    key: string,
    fingerprint: string,
    id: string,
  ): Promise<void>;
}
export class FreeCancellation {
  constructor(
    private store: FreeCancellationStore,
    private inventory: FreeCancellationInventory,
    private tickets: UnusedTicketCancellation,
    private events: DurableEvents,
    private audit: SecurityAudit,
  ) {}
  private eligibility(order: any) {
    const cutoff = order.snapshot?.quote?.policy?.freeCancellationCutoffMinutes;
    if (
      order.state !== "confirmed" ||
      order.amount_paise !== 0 ||
      !order.free_confirmed ||
      !Number.isInteger(cutoff) ||
      cutoff < 0 ||
      cutoff > 525600
    )
      throw new AppError(
        "CANCELLATION_NOT_ALLOWED",
        "This booking has no applicable confirmed-free-booking cancellation policy.",
        409,
      );
    return cutoff as number;
  }
  preview(owner: string, id: string) {
    return this.store.unitOfWork(async (tx) => {
      const order = await this.store.lock(tx, owner, id),
        cutoff = this.eligibility(order),
        inventory = await this.inventory.inspect(
          tx,
          owner,
          order.reservation_id,
          cutoff,
        ),
        tickets = await this.tickets.inspect(tx, id, inventory.quantity);
      const fingerprint = JSON.stringify([inventory.fingerprint, tickets]);
      const previewId = await this.store.preview(
        tx,
        owner,
        id,
        fingerprint,
        inventory.expiresAt,
      );
      return {
        previewId,
        expiresAt: inventory.expiresAt.toISOString(),
        serverTime: new Date().toISOString(),
        items: inventory.items,
        ticketCount: tickets.length,
        refundPaise: 0,
        refundStatus: "not_required",
        consequence:
          "Cancel the entire free booking, revoke all tickets and return its capacity. No refund is due.",
      };
    });
  }
  cancel(owner: string, id: string, key: string, input: FreeCancelInput) {
    return this.store.unitOfWork(async (tx) => {
      await this.store.serialize(tx, owner);
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            id,
            previewId: input.previewId,
            reason: input.reason,
            confirm: input.confirm,
          }),
        )
        .digest("hex");
      const prior = await this.store.prior(tx, owner, key, fingerprint);
      const order = await this.store.lock(tx, owner, id);
      if (prior || (await this.store.cancelled(tx, id))) {
        if (!prior) await this.store.command(tx, owner, key, fingerprint, id);
        return {
          orderId: id,
          bookingState: "cancelled",
          refundStatus: "not_required",
        };
      }
      const cutoff = this.eligibility(order),
        inventory = await this.inventory.inspect(
          tx,
          owner,
          order.reservation_id,
          cutoff,
        ),
        tickets = await this.tickets.inspect(tx, id, inventory.quantity);
      await this.store.validate(
        tx,
        owner,
        id,
        input.previewId,
        JSON.stringify([inventory.fingerprint, tickets]),
      );
      await this.tickets.revoke(tx, tickets);
      await this.inventory.release(tx, owner, order.reservation_id);
      await this.store.finish(tx, owner, id, input.reason);
      await this.events.publish(tx, "booking.free_cancelled", id, {
        ownerId: owner,
      });
      await this.audit.record(tx, owner, "booking.free_cancelled", id, {
        reason: input.reason,
        ticketCount: tickets.length,
      });
      await this.store.command(tx, owner, key, fingerprint, id);
      return {
        orderId: id,
        bookingState: "cancelled",
        refundStatus: "not_required",
      };
    });
  }
}
