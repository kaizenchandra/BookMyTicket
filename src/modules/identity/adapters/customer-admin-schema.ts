import { z } from "zod";
export const customerFilterInput = z
  .object({
    id: z.uuid().optional(),
    contact: z.string().trim().min(3).max(254).optional(),
    q: z.string().trim().max(100).optional(),
    status: z.enum(["active", "suspended"]).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    activity: z
      .enum(["all", "has_bookings", "no_bookings", "repeat_confirmed"])
      .optional(),
    bookingFrom: z.iso.datetime({ offset: true }).optional(),
    bookingUntil: z.iso.datetime({ offset: true }).optional(),
    sort: z.enum(["newest", "oldest"]).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.from) < Date.parse(f.until),
    "Registration end must follow start",
  )
  .refine(
    (f) =>
      !f.bookingFrom ||
      !f.bookingUntil ||
      Date.parse(f.bookingFrom) < Date.parse(f.bookingUntil),
    "Booking end must follow start",
  )
  .refine(
    (f) =>
      !(f.bookingFrom || f.bookingUntil) ||
      (!!f.activity && f.activity !== "all"),
    "Select a booking activity filter when using activity dates",
  );
export const customerFilters = z.preprocess(
  (v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).filter(([, v]) => v !== ""))
      : v,
  customerFilterInput,
);
export const customerStatusChange = z
  .object({
    expectedVersion: z.number().int().positive(),
    status: z.enum(["active", "suspended"]),
    customerFlags: z
      .array(z.enum(["review_required", "contact_support", "payment_review"]))
      .max(3)
      .refine((x) => new Set(x).size === x.length, "Duplicate flag"),
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const customerHistoryFilters = z
  .object({
    kind: z.enum(["bookings", "payments", "support"]),
    after: z.string().max(1500).optional(),
  })
  .strict();
export const customerAccount = z.object({
  id: z.uuid(),
  status: z.enum(["active", "suspended"]),
  contact: z.string(),
  created_at: z.string(),
  version: z.number().int().positive(),
  flags: z.array(z.string()),
  contact_verified_at: z.string().nullable(),
  contact_verification: z.enum(["verified", "verified_legacy", "not_recorded"]),
});
const activity = z.object({
  bookings: z.string(),
  confirmed: z.string(),
  cancelled: z.string(),
  lastBookingAt: z.string().nullable(),
});
export const customerPage = z.object({
  items: z
    .array(
      customerAccount.extend({
        profile: z.object({ name: z.string(), city: z.string().nullable() }),
        activity,
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
export const customerDetail = z.object({
  account: customerAccount,
  activity,
  permissions: z.object({
    bookings: z.boolean(),
    payments: z.boolean(),
    support: z.boolean(),
    manage: z.boolean(),
  }),
  profile: z.object({
    name: z.string(),
    city: z.string().nullable(),
    theme: z.string(),
    version: z.number(),
    savedAttendees: z.object({
      available: z.boolean(),
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          phone: z.string(),
        }),
      ),
    }),
    wallet: z.object({ supported: z.literal(false) }),
    loyalty: z.object({ supported: z.literal(false) }),
  }),
});
export const customerHistoryPage = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        state: z.string(),
        amount_paise: z.string().nullable(),
        at: z.string(),
        label: z.string(),
        booking_id: z.uuid().nullable(),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
