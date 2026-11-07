import type { PaymentProvider, ProviderPayment } from "./provider.ts";
import type { CapturedPayment } from "../contracts/index.ts";
import type { PaymentOrderAccess } from "../contracts/payment-order.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export type CollectionRecord = {
  order_id: string;
  amount_paise: number;
  state: string;
  provider_id: string | null;
  newAttempt?: boolean;
  checked_at?: Date | null;
  review_required?: boolean;
  retry_eligible?: boolean;
};
export interface CollectionStore {
  prepare(
    tx: Transaction,
    orderId: string,
    amount: number,
  ): Promise<CollectionRecord>;
  get(orderId: string): Promise<CollectionRecord | undefined>;
  created(orderId: string, providerId: string): Promise<void>;
  unknown(orderId: string): Promise<void>;
  findByProviderId(
    providerId: string,
  ): Promise<{ order_id: string; amount_paise: number } | undefined>;
  observe(orderId: string, payment: ProviderPayment): Promise<string>;
  claimRetry(tx: Transaction, orderId: string): Promise<void>;
  summary(orderId: string): Promise<unknown[]>;
}
export class Collection {
  constructor(
    private provider: PaymentProvider,
    private store: CollectionStore,
    private confirm: (p: CapturedPayment) => Promise<unknown>,
    private orders: PaymentOrderAccess,
  ) {}
  available() {
    return this.provider.available();
  }
  async initiate(ownerId: string, orderId: string) {
    await this.orders.owned(ownerId, orderId);
    const key = this.provider.publicKey();
    const previous = await this.store.get(orderId);
    if (previous?.state === "ready") await this.reconcileOrder(orderId);
    const attempt = await this.orders.prepare(
      ownerId,
      orderId,
      async (tx, order) => {
        const result = await this.store.prepare(
          tx,
          order.id,
          order.amount_paise,
        );
        if (!result.newAttempt && result.state === "ready")
          await this.store.claimRetry(tx, orderId);
        return result;
      },
    );
    // Reopening checkout requires explicit recovery rather than inviting a duplicate payment.
    if (!attempt.newAttempt && attempt.state !== "ready")
      throw new AppError(
        "PAYMENT_RECONCILING",
        "A payment session already exists. Check its status; do not pay again while it is unresolved.",
        409,
      );
    if (!attempt.newAttempt)
      return {
        key,
        providerOrderId: attempt.provider_id!,
        amountPaise: attempt.amount_paise,
        currency: "INR" as const,
      };
    try {
      const created = await this.provider.createOrder(
        attempt.amount_paise,
        orderId,
      );
      if (
        !/^order_[A-Za-z0-9]+$/.test(created.id) ||
        created.amount !== attempt.amount_paise ||
        created.currency !== "INR"
      )
        throw new AppError(
          "PROVIDER_MISMATCH",
          "Provider order does not match the accepted amount.",
          409,
        );
      await this.store.created(orderId, created.id);
      if (
        (await this.orders.owned(ownerId, orderId)).state !== "pending_payment"
      )
        throw new AppError(
          "PAYMENT_NOT_ALLOWED",
          "Order status changed while preparing payment. Check the booking status.",
          409,
        );
      return {
        key,
        providerOrderId: created.id,
        amountPaise: attempt.amount_paise,
        currency: "INR" as const,
      };
    } catch (error) {
      await this.store.unknown(orderId);
      throw error;
    }
  }
  async status(ownerId: string, orderId: string) {
    const order = await this.orders.owned(ownerId, orderId),
      record = await this.store.get(orderId),
      attempts = (await this.store.summary(orderId)) as { state: string }[];
    const retryable =
      record?.state === "ready" &&
      !record.review_required &&
      record.retry_eligible === true;
    let allowed =
      order.amount_paise > 0 &&
      order.state === "pending_payment" &&
      (!record || retryable) &&
      this.available();
    let reason: string | null =
      order.amount_paise === 0
        ? "PAYMENT_NOT_REQUIRED"
        : !this.available()
          ? "PAYMENTS_UNAVAILABLE"
          : record && !retryable
            ? "CHECK_EXISTING_PAYMENT"
            : order.state !== "pending_payment"
              ? "PAYMENT_NOT_ALLOWED"
              : null;
    if (allowed)
      try {
        await this.orders.prepare(ownerId, orderId, async () => undefined);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        allowed = false;
        reason = error.code;
      }
    return {
      orderId,
      bookingState: order.state,
      paymentState:
        order.amount_paise === 0 && !record && !attempts.length
          ? "not_required"
          : record?.review_required
            ? "review_required"
            : (record?.state ?? "not_started"),
      checkedAt: record?.checked_at ?? null,
      serverTime: new Date().toISOString(),
      attempts,
      allowedActions: { initiate: allowed, reason },
    };
  }
  async callback(
    ownerId: string,
    orderId: string,
    paymentId: string,
    signature: string,
  ) {
    await this.orders.owned(ownerId, orderId);
    const stored = await this.store.get(orderId);
    if (
      !stored?.provider_id ||
      !this.provider.verifyCheckout(stored.provider_id, paymentId, signature)
    )
      throw new AppError(
        "INVALID_PAYMENT_SIGNATURE",
        "Payment response could not be verified.",
        422,
      );
    await this.reconcile(paymentId, orderId);
    return this.status(ownerId, orderId);
  }
  async reconcileOrder(orderId: string) {
    let record = await this.store.get(orderId);
    if (!record)
      throw new AppError(
        "PAYMENT_UNMAPPED",
        "Payment order is not available.",
        409,
      );
    if (!record.provider_id) {
      const found = await this.provider.findOrders(orderId);
      if (found.length !== 1)
        throw new AppError(
          found.length ? "PROVIDER_AMBIGUOUS" : "PAYMENT_RECONCILING",
          "Payment order lookup is unresolved; no duplicate order will be created.",
          409,
        );
      const order = found[0];
      if (
        !/^order_[A-Za-z0-9]+$/.test(order.id) ||
        order.amount !== record.amount_paise ||
        order.currency !== "INR" ||
        order.receipt !== orderId
      )
        throw new AppError(
          "PROVIDER_MISMATCH",
          "Payment order requires investigation.",
          409,
        );
      await this.store.created(orderId, order.id);
      record = { ...record, provider_id: order.id };
    }
    const payments = await this.provider.orderPayments(record.provider_id!);
    for (const payment of payments) {
      if (payment.order_id !== record.provider_id)
        throw new AppError(
          "PROVIDER_MISMATCH",
          "Payment association requires investigation.",
          409,
        );
      await this.acceptObservation(payment, orderId, record.amount_paise);
    }
  }
  async reconcile(paymentId: string, expectedOrderId?: string) {
    const payment = await this.provider.fetchPayment(paymentId);
    if (payment.id !== paymentId)
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Payment identifier did not match.",
        409,
      );
    const mapping = await this.store.findByProviderId(payment.order_id);
    if (!mapping || (expectedOrderId && mapping.order_id !== expectedOrderId))
      throw new AppError(
        "PAYMENT_UNMAPPED",
        "Provider order mapping is not available.",
        409,
      );
    return this.acceptObservation(
      payment,
      mapping.order_id,
      mapping.amount_paise,
    );
  }
  private async acceptObservation(
    payment: ProviderPayment,
    orderId: string,
    amount: number,
  ) {
    if (
      !/^pay_[A-Za-z0-9]+$/.test(payment.id) ||
      payment.currency !== "INR" ||
      payment.amount !== amount ||
      !Number.isSafeInteger(payment.amount)
    )
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Payment amount, currency or identifier requires investigation.",
        409,
      );
    if (
      !["created", "authorized", "captured", "refunded", "failed"].includes(
        payment.status,
      )
    )
      throw new AppError(
        "PROVIDER_STATE_UNSUPPORTED",
        "Payment state requires investigation.",
        409,
      );
    const observed = await this.store.observe(orderId, payment);
    if (observed === "refunded") return { state: observed };
    if (payment.status !== "captured") return { state: payment.status };
    return this.confirm({
      id: payment.id,
      orderId,
      amountPaise: payment.amount,
      currency: "INR",
    });
  }
}
