import { z } from "zod";
export const reviewHistoryFilters = z
  .object({
    beforeVersion: z.coerce
      .number()
      .int()
      .positive()
      .max(2147483647)
      .optional(),
  })
  .strict();
export const reviewHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            version: z.number().int().positive(),
            inputVersion: z.number().int().positive(),
            decision: z.enum(["approved", "changes_requested", "rejected"]),
            reason: z.string(),
            createdAt: z.iso.datetime(),
            reviewerId: z.uuid().optional(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.number().int().positive().nullable(),
  })
  .strict();
export const providerReviewInput = z
  .object({
    version: z.number().int().positive().max(2147483646),
    state: z.enum(["approved", "changes_requested", "rejected"]),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
