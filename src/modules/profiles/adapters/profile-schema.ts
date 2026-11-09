import { z } from "zod";
export const profileInput = z
  .object({
    name: z.string().trim().max(100),
    theme: z.enum(["LIGHT", "DARK"]),
    city: z.string().trim().min(1).max(100).nullable(),
    expectedVersion: z.number().int().min(0).max(2147483646),
  })
  .strict();
export const profileResponse = z
  .object({
    name: z.string(),
    theme: z.enum(["LIGHT", "DARK"]),
    city: z.string().nullable(),
    version: z.number().int().nonnegative(),
  })
  .strict();
