import { z } from "zod";
export const organizationCreationInput = z
  .object({
    name: z.string().trim().min(2).max(150),
    kind: z.enum(["cinema", "event", "sports"]),
  })
  .strict();
export const organizationCreationKey = z.string().min(8).max(100);
