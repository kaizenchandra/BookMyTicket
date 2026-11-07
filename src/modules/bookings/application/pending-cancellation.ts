import { createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import type { PendingOrderRelease } from "../../inventory/contracts/index.ts";
import type { CancellationPaymentStatus } from "../../payments/contracts/index.ts";
import type {
  DurableEvents,
  SecurityAudit,
} from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export type PendingCancelInput = {
  previewId: string;
  reason: string;
  acknowledgePaymentRisk: boolean;
};
export interface PendingCancellationStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  serialize(tx: Transaction, owner: string): Promise<void>;
  lock(
    tx: Transaction,
    owner: string,
    id: string,
  ): Promise<{
    id: string;
    state: string;
    reservation_id: string;
    server_time: Date;
  }>;
  preview(
    tx: Transaction,
    owner: string,
    id: string,
    activity: boolean,
  ): Promise<{ id: string; expires_at: Date }>;
  validatePreview(
    tx: Transaction,
    owner: string,
    id: string,
    preview: string,
    activity: boolean,
  ): Promise<void>;
  prior(
    tx: Transaction,
    owner: string,
    key: string,
    fingerprint: string,
  ): Promise<string | null>;
  record(
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
  result(tx: Transaction, id: string): Promise<unknown>;
}
export class PendingCancellation {
  constructor(
    private store: PendingCancellationStore,
    private inventory: PendingOrderRelease,
    private payments: CancellationPaymentStatus,
    private events: DurableEvents,
    private audit: SecurityAudit,
  ) {}
  preview(owner: string, id: string) {
    return this.store.unitOfWork(async (tx) => {
      const order = await this.store.lock(tx, owner, id),
        payment = await this.payments.pendingCancellation(tx, id);
      const allowed = order.state === "pending_payment";
      const preview = allowed
        ? await this.store.preview(tx, owner, id, payment.paymentActivity)
        : null;
      return {
        orderId: id,
        bookingState: order.state,
        allowed,
        reason: allowed
          ? null
          : order.state === "cancelled"
            ? "ALREADY_CANCELLED"
            : "CONFIRMED_POLICY_REQUIRED",
        previewId: preview?.id ?? null,
        expiresAt: preview?.expires_at ?? null,
        serverTime: order.server_time,
        paymentActivity: payment.paymentActivity,
        recovery: payment.recovery,
        refundAmountPaise: null,
        consequence:
          "Cancelling releases the reservation and stops this order from being fulfilled. It does not prove that a payment was stopped or a refund completed. Any late capture requires refund recovery.",
      };
    });
  }
  async cancel(
    owner: string,
    id: string,
    key: string,
    input: PendingCancelInput,
  ) {
    if (
      !input.acknowledgePaymentRisk ||
      input.reason.trim().length < 5 ||
      input.reason.length > 500 ||
      key.length < 8 ||
      key.length > 100
    )
      throw new AppError(
        "INVALID_CANCELLATION",
        "Confirm the payment notice and provide a cancellation reason.",
        422,
      );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          id,
          previewId: input.previewId,
          reason: input.reason.trim(),
          acknowledgePaymentRisk: true,
        }),
      )
      .digest("hex");
    return this.store.unitOfWork(async (tx) => {
      await this.store.serialize(tx, owner);
      const previous = await this.store.prior(tx, owner, key, fingerprint);
      if (previous) return this.store.result(tx, previous);
      const order = await this.store.lock(tx, owner, id);
      if (order.state !== "cancelled") {
        if (order.state !== "pending_payment")
          throw new AppError(
            "CANCELLATION_NOT_ALLOWED",
            "This order is no longer awaiting payment. Refresh its status before requesting a policy-based cancellation.",
            409,
          );
        const payment = await this.payments.pendingCancellation(tx, id);
        await this.store.validatePreview(
          tx,
          owner,
          id,
          input.previewId,
          payment.paymentActivity,
        );
        await this.inventory.release(tx, owner, order.reservation_id);
        await this.store.record(tx, owner, id, input.reason.trim());
        await this.events.publish(tx, "booking.pending_cancelled", id, {
          ownerId: owner,
        });
        await this.audit.record(tx, owner, "booking.pending_cancelled", id, {
          reservationId: order.reservation_id,
          paymentActivity: payment.paymentActivity,
        });
      }
      const result = await this.store.result(tx, id);
      await this.store.command(tx, owner, key, fingerprint, id);
      return result;
    });
  }
}
