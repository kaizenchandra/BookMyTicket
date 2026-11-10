import { z } from "zod";
const integer = z.string().regex(/^\d+$/);
export const dashboardFilters = z
  .object({
    product: z.enum(["movie", "event", "sports"]).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    supplier: z.uuid().optional(),
    state: z
      .enum(["pending_payment", "confirmed", "cancelled", "refund_required"])
      .optional(),
    currency: z.literal("INR").default("INR"),
    year: z.coerce.number().int().min(2000).max(2100),
    group: z.enum(["month", "quarter", "year"]),
    index: z.coerce.number().int().min(1).max(12).default(1),
    range: z
      .enum(["today", "yesterday", "7days", "30days", "custom"])
      .optional(),
    from: z.iso.date().optional(),
    until: z.iso.date().optional(),
  })
  .strict()
  .refine(
    (q) => q.index <= (q.group === "year" ? 1 : q.group === "quarter" ? 4 : 12),
    { message: "Invalid period index" },
  )
  .refine(
    (q) =>
      q.range === "custom"
        ? !!q.from &&
          !!q.until &&
          Date.parse(q.until) > Date.parse(q.from) &&
          Date.parse(q.until) - Date.parse(q.from) <= 366 * 86400000
        : !q.from && !q.until,
    { message: "Custom dates require an increasing range of at most 366 days" },
  );
export const dashboardPage = z.object({
  snapshotId: z.uuid(),
  historical: z.boolean(),
  definitionVersion: z.string(),
  filters: z.object({
    product: z.string().nullable(),
    city: z.string().nullable(),
    supplier: z.string().nullable(),
    state: z.string().nullable(),
    currency: z.literal("INR"),
  }),
  grain: z.enum(["day", "month"]),
  timeseries: z.array(
    z.object({ bucket: z.string(), bookings: integer, gbv: integer }),
  ),
  support: z
    .object({
      open_cases: integer,
      escalated_cases: integer,
      urgent_cases: integer,
    })
    .nullable(),
  asOf: z.string(),
  currency: z.literal("INR"),
  includesDemo: z.literal(true),
  period: z.object({
    from: z.string(),
    until: z.string(),
    year: z.number(),
    group: z.enum(["month", "quarter", "year"]),
    index: z.number(),
    timeZone: z.literal("Asia/Kolkata"),
  }),
  bookings: z.object({
    active_customers: integer,
    states: z.array(
      z.object({ state: z.string(), bookings: integer, amount_paise: integer }),
    ),
    bookings: integer,
    confirmed: integer,
    cancelled: integer,
    gbv: integer,
    demo_bookings: integer,
    customers: integer,
    repeat_customers: integer,
    trend: z.array(
      z.object({ month: z.string(), bookings: integer, gbv: integer }),
    ),
    latest: z
      .array(
        z.object({
          id: z.uuid(),
          state: z.enum([
            "pending_payment",
            "confirmed",
            "refund_required",
            "cancelled",
          ]),
          amount_paise: integer,
          created_at: z.string(),
          confirmed_at: z.string().nullable(),
          title: z.string(),
        }),
      )
      .max(20),
  }),
  payments: z.object({
    failed_attempts: integer,
    payment_exceptions: integer,
    captures: integer,
    captured_paise: integer,
    provider_refunded_attempts: integer,
    recovery: z.array(
      z.object({ state: z.string(), cases: integer, amount_paise: integer }),
    ),
  }),
  inventory: z.object({
    occurrences: integer,
    capacity: integer,
    sold: integer,
    held: integer,
    unallocated: z.string().regex(/^-?\d+$/),
  }),
  verticals: z.array(
    z.object({
      kind: z.string(),
      bookings: integer,
      confirmed: integer,
      gbv: integer,
    }),
  ),
});

export const dashboardRecordKind = z.enum([
  "bookings",
  "confirmed",
  "cancelled",
  "customers",
  "captures",
  "recovery",
  "refunded",
  "failed",
  "exceptions",
  "support",
]);
export const dashboardRecordsPage = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        state: z.string(),
        amount_paise: z.string().nullable(),
        at: z.string(),
        label: z.string(),
        booking_id: z.uuid().nullable().optional(),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
