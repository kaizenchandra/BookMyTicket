import { z } from "zod";
export const organizationDraftInput = z
  .object({
    name: z.string().trim().min(2).max(150),
    expectedVersion: z.number().int().positive().max(2147483646),
  })
  .strict();
export const organizationSubmitInput = z
  .object({ version: z.number().int().positive().max(2147483646) })
  .strict();
