import { z } from "zod";
export const onboardingDetails = z
  .object({
    legalName: z.string().trim().max(200),
    businessAddress: z.string().trim().max(2000),
    contactName: z.string().trim().max(100),
    contactEmail: z.union([z.literal(""), z.email().max(254)]),
    contactPhone: z.union([
      z.literal(""),
      z.string().regex(/^\+[1-9][0-9]{6,14}$/),
    ]),
  })
  .strict();
export const onboardingInput = onboardingDetails
  .extend({ expectedVersion: z.number().int().positive().max(2147483646) })
  .strict();
export const onboardingResponse = z
  .object({
    organizationId: z.uuid(),
    version: z.number().int().positive(),
    state: z.string(),
    details: onboardingDetails,
  })
  .strict();
