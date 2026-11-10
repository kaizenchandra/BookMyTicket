import { z } from "zod";
export const adminBookingFiltersInput = z
  .object({
    product: z.enum(["movie", "event", "sports"]).optional(),
    supplier: z.uuid().optional(),
    pnr: z.string().trim().min(1).max(100).optional(),
    travelFrom: z.iso.datetime({ offset: true }).optional(),
    travelUntil: z.iso.datetime({ offset: true }).optional(),
    exception: z
      .enum(["stalled", "refund_required", "open", "escalated", "resolved"])
      .optional(),
    assignedTo: z.uuid().optional(),
    id: z.uuid().optional(),
    customer: z.uuid().optional(),
    state: z
      .enum(["pending_payment", "confirmed", "cancelled", "refund_required"])
      .optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    confirmed: z.enum(["true"]).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict()
  .refine(
    (f) =>
      (!f.from || !f.until || Date.parse(f.from) < Date.parse(f.until)) &&
      (!f.travelFrom ||
        !f.travelUntil ||
        Date.parse(f.travelFrom) < Date.parse(f.travelUntil)),
    { message: "End must be later than start" },
  );
export const adminPaymentFilters = z
  .object({ after: z.string().max(2000).optional() })
  .strict();

export const adminBookingFilters = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ""));
}, adminBookingFiltersInput);
const adminBooking = z.object({
  id: z.uuid(),
  customer_id: z.uuid(),
  state: z.enum([
    "pending_payment",
    "confirmed",
    "cancelled",
    "refund_required",
  ]),
  amount_paise: z.string().regex(/^\d+$/),
  currency: z.literal("INR"),
  created_at: z.string(),
  confirmed_at: z.string().nullable(),
  title: z.string(),
});
export const adminBookingPage = z.object({
  items: z.array(adminBooking).max(25),
  nextCursor: z.string().nullable(),
});
