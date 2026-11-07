import { z } from "zod";
export const freeCancelInput = z
  .object({
    previewId: z.uuid(),
    reason: z.string().trim().min(5).max(500),
    confirm: z.literal(true),
  })
  .strict();
