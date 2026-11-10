import { z } from "zod";
export const paymentAdminFilters = z
  .object({
    booking: z.uuid().optional(),
    transaction: z.string().trim().min(1).max(100).optional(),
    provider: z.literal("razorpay").optional(),
    method: z
      .enum([
        "card",
        "upi",
        "netbanking",
        "wallet",
        "emi",
        "bank_transfer",
        "paylater",
      ])
      .optional(),
    state: z
      .enum(["created", "authorized", "captured", "refunded", "failed"])
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    exception: z.literal("true").optional(),
    after: z.string().max(1500).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.until) > Date.parse(f.from),
    "End must follow start",
  );
export const paymentReportInput = z
  .object({
    filters: paymentAdminFilters,
    reason: z.string().trim().min(10).max(1000),
    confirm: z.literal(true),
  })
  .strict();
export const paymentDetailQuery = z
  .object({ after: z.string().max(1500).optional() })
  .strict();
export const paymentAdminRow = z.object({
  id: z.uuid(),
  transaction_id: z.string(),
  booking_id: z.uuid(),
  provider: z.literal("razorpay"),
  method: z.string().nullable(),
  state: z.string(),
  amount_paise: z.string(),
  currency: z.literal("INR"),
  amount_refunded_paise: z.string().nullable(),
  error_code: z.string().nullable(),
  error_reason: z.string().nullable(),
  created_at: z.string(),
  review_required: z.boolean(),
  last_error_code: z.string().nullable(),
});
export const paymentAdminPage = z.object({
  items: z.array(paymentAdminRow).max(25),
  nextCursor: z.string().nullable(),
});
export const paymentReportResponse = z.object({
  filename: z.literal("payment-transactions.csv"),
  csv: z.string(),
  rows: z.number().int().min(0).max(5000),
});
const reconciliation = z.object({
  state: z.string(),
  provider_id: z.string().nullable(),
  checked_at: z.string().nullable(),
  available_at: z.string(),
  failures: z.number().int(),
  last_error_code: z.string().nullable(),
  review_required: z.boolean(),
  in_progress: z.boolean().nullable(),
});
export const paymentAdminDetail = z.object({
  attempt: paymentAdminRow
    .omit({ created_at: true, review_required: true, last_error_code: true })
    .extend({ observed_at: z.string() }),
  capture: z
    .object({
      amount_paise: z.string(),
      currency: z.string(),
      captured_at: z.string(),
    })
    .nullable(),
  recovery: z
    .object({
      id: z.uuid(),
      state: z.string(),
      reason: z.string(),
      amount_paise: z.string(),
      created_at: z.string(),
    })
    .nullable(),
  reconciliation,
  history: z.object({
    items: z
      .array(
        z.object({
          id: z.uuid(),
          previous_state: z.string().nullable(),
          state: z.string(),
          amount_paise: z.string(),
          method: z.string().nullable(),
          error_code: z.string().nullable(),
          error_reason: z.string().nullable(),
          amount_refunded_paise: z.string().nullable(),
          recorded_at: z.string(),
        }),
      )
      .max(25),
    nextCursor: z.string().nullable(),
  }),
  settlement: z.object({
    state: z.literal("not_connected"),
    amountPaise: z.null(),
  }),
  capturePolicy: z.object({
    mode: z.literal("merchant_auto_capture"),
    partialCaptureSupported: z.literal(false),
  }),
  refundEligibility: z.object({
    eligible: z.null(),
    actionAvailable: z.literal(false),
    reason: z.string(),
  }),
});
export const paymentExceptionPage = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        provider_id: z.string().nullable(),
        state: z.string(),
        amount_paise: z.string(),
        created_at: z.string(),
        checked_at: z.string().nullable(),
        failures: z.number(),
        last_error_code: z.string().nullable(),
        review_required: z.boolean(),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
