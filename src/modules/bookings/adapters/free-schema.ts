import { z } from "zod";
export const freeConfirmationInput = z
  .object({ confirm: z.literal(true) })
  .strict();
export const freeConfirmationResponse = z
  .object({
    orderId: z.uuid(),
    bookingState: z.enum([
      "confirmed",
      "cancelled",
      "refund_required",
      "pending_payment",
    ]),
    paymentState: z.literal("not_required"),
  })
  .strict();
