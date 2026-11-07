import { z } from "zod";
export const exportInput = z
  .object({
    occurrenceId: z.string().uuid(),
    formId: z.string().uuid(),
    fields: z
      .array(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/))
      .min(1)
      .max(20),
    purpose: z.string().trim().min(10).max(500),
    confirmScope: z.literal(true),
  })
  .strict();
