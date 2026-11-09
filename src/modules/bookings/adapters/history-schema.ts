import { z } from "zod";
export const historyFilters = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    state: z
      .enum(["pending_payment", "confirmed", "refund_required", "cancelled"])
      .optional(),
    period: z.enum(["upcoming", "past"]).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    after: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.from) < Date.parse(f.until),
    "Until must be after From.",
  );

export const historyPage = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          amount_paise: z.number().int().nonnegative(),
          currency: z.literal("INR"),
          state: z.enum([
            "pending_payment",
            "confirmed",
            "refund_required",
            "cancelled",
          ]),
          created_at: z.iso.datetime(),
          confirmed_at: z.iso.datetime().nullable(),
          occurrences: z.array(
            z
              .object({
                id: z.uuid(),
                listingId: z.uuid().optional(),
                title: z.string().optional(),
                isDemo: z.boolean().optional(),
                venueName: z.string(),
                timeZone: z.string(),
                startsAt: z.iso.datetime(),
                endsAt: z.iso.datetime(),
              })
              .strict(),
          ),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
    serverTime: z.iso.datetime(),
  })
  .strict();
