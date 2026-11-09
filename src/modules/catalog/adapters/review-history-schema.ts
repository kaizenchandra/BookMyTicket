import { z } from "zod";
export const listingReviewHistoryFilters = z
  .object({
    beforeVersion: z.coerce
      .number()
      .int()
      .positive()
      .max(2147483647)
      .optional(),
  })
  .strict();
export const listingReviewHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            version: z.number().int().positive(),
            inputVersion: z.number().int().positive(),
            decision: z.enum(["published", "changes_requested"]),
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
