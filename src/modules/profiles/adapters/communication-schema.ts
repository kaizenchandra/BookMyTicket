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
