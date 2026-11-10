import { z } from "zod";
import { bookingMilestoneKinds } from "../domain/timeline.ts";
export const bookingTimelinePage = z
  .object({
    bookingId: z.uuid(),
    currentState: z.enum([
      "pending_payment",
      "confirmed",
      "refund_required",
      "cancelled",
    ]),
    serverTime: z.iso.datetime(),
    items: z
      .array(
        z
          .object({
            kind: z.enum(bookingMilestoneKinds),
            occurredAt: z.iso.datetime(),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();
export type BookingTimelinePage = z.infer<typeof bookingTimelinePage>;
