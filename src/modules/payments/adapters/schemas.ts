import { z } from "zod";
export const paymentInitiationSchema = z.object({}).strict();
export const paymentCallbackSchema = z
  .object({
    paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
    signature: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();
export const paymentCheckoutSchema = z
  .object({
    key: z.string(),
    providerOrderId: z.string().regex(/^order_[A-Za-z0-9]+$/),
    amountPaise: z.number().int().positive(),
    currency: z.literal("INR"),
  })
  .strict();
export const paymentStatusSchema = z
  .object({
    orderId: z.uuid(),
    bookingState: z.enum([
      "pending_payment",
      "confirmed",
      "refund_required",
      "cancelled",
    ]),
    paymentState: z.enum([
      "not_required",
      "not_started",
      "creating",
      "ready",
      "unknown",
      "failed",
      "review_required",
    ]),
    checkedAt: z.iso.datetime().nullable(),
    serverTime: z.iso.datetime(),
    attempts: z.array(
      z
        .object({
          state: z.enum([
            "created",
            "authorized",
            "captured",
            "refunded",
            "failed",
          ]),
          amount_paise: z.number().int().positive(),
          currency: z.literal("INR"),
          observed_at: z.iso.datetime(),
        })
        .strict(),
    ),
    allowedActions: z
      .object({ initiate: z.boolean(), reason: z.string().nullable() })
      .strict(),
  })
  .strict();
