import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../../shared/errors.ts";
import type {
  PaymentProvider,
  ProviderPayment,
} from "../application/provider.ts";
export function verifyHmac(
  bytes: Buffer | string,
  signature: string,
  secret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  return timingSafeEqual(
    createHmac("sha256", secret).update(bytes).digest(),
    Buffer.from(signature, "hex"),
  );
}
export class Razorpay implements PaymentProvider {
  constructor(
    private keyId = process.env.RAZORPAY_KEY_ID,
    private secret = process.env.RAZORPAY_KEY_SECRET,
  ) {}
  available() {
    return !!this.keyId?.startsWith("rzp_live_") && !!this.secret;
  }
  publicKey() {
    if (!this.available())
      throw new AppError(
        "PAYMENTS_UNAVAILABLE",
        "Payment collection is not configured.",
        503,
      );
    return this.keyId!;
  }
  async findOrders(receipt: string) {
    const result = (await this.request(
      `orders?receipt=${encodeURIComponent(receipt)}&count=100`,
    )) as { items: import("../application/provider.ts").ProviderOrder[] };
    if (!Array.isArray(result.items) || result.items.length >= 100)
      throw new AppError(
        "PROVIDER_AMBIGUOUS",
        "Provider order lookup requires review.",
        409,
      );
    return result.items.filter((item) => item.receipt === receipt);
  }
  async orderPayments(id: string) {
    if (!/^order_[A-Za-z0-9]+$/.test(id))
      throw new AppError(
        "INVALID_ORDER",
        "Invalid provider order reference.",
        422,
      );
    const result = (await this.request(`orders/${id}/payments`)) as {
      items: ProviderPayment[];
    };
    if (!Array.isArray(result.items))
      throw new AppError(
        "PROVIDER_MISMATCH",
        "Invalid provider response.",
        503,
      );
    return result.items;
  }
  async request(path: string, body?: unknown) {
    if (!this.keyId || !this.secret)
      throw new AppError(
        "PAYMENTS_UNAVAILABLE",
        "Payment collection is not configured.",
        503,
      );
    if (!this.keyId.startsWith("rzp_live_"))
      throw new AppError(
        "TEST_MODE_NOT_AUTHORIZED",
        "Provider Test Mode needs an explicit verification exception.",
        503,
      );
    const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok)
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Payment provider request failed; reconcile the outcome before retrying.",
        503,
      );
    return r.json();
  }
  async createOrder(amountPaise: number, receipt: string) {
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0)
      throw new AppError(
        "INVALID_AMOUNT",
        "A positive integer amount is required.",
        422,
      );
    return this.request("orders", {
      amount: amountPaise,
      currency: "INR",
      receipt,
    }) as Promise<{ id: string; amount: number; currency: string }>;
  }
  async fetchPayment(id: string) {
    if (!/^pay_[A-Za-z0-9]+$/.test(id))
      throw new AppError("INVALID_PAYMENT", "Invalid payment reference.", 422);
    return this.request(`payments/${id}`) as Promise<ProviderPayment>;
  }
  verifyCheckout(storedOrderId: string, paymentId: string, signature: string) {
    return verifyHmac(
      `${storedOrderId}|${paymentId}`,
      signature,
      this.secret ?? "",
    );
  }
}
