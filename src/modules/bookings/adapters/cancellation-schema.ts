import { z } from "zod";
export const pendingCancelInput = z
  .object({
    previewId: z.string().uuid(),
    reason: z.string().trim().min(5).max(500),
    acknowledgePaymentRisk: z.literal(true),
  })
  .strict();
