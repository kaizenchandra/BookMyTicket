import { z } from "zod";
export const communicationInput = z
  .object({
    language: z.enum([
      "en",
      "hi",
      "kn",
      "ta",
      "te",
      "mr",
      "bn",
      "ml",
      "gu",
      "pa",
    ]),
    marketingEmail: z.boolean(),
    version: z.number().int().nonnegative(),
    consentVersion: z.literal(1),
  })
  .strict();

export const consentHistoryFilters = z
  .object({
    beforeVersion: z
      .string()
      .regex(/^[1-9][0-9]{0,9}$/)
      .refine((v) => Number(v) <= 2147483647, "Version is out of range.")
      .optional(),
  })
  .strict();
export const consentHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            purpose: z.literal("marketing_email"),
            policyVersion: z.literal(1),
            granted: z.boolean(),
            preferenceVersion: z.number().int().positive(),
            recordedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.number().int().positive().nullable(),
  })
  .strict();
