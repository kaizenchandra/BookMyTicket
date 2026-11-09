import { z } from "zod";
export const listingQueueFilters = z
  .object({
    kind: z
      .union([z.enum(["movie", "event", "sports"]), z.literal("")])
      .optional(),
    afterCreatedAt: z.iso.datetime({ precision: 6 }).optional(),
    afterId: z.uuid().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.afterCreatedAt) === Boolean(v.afterId), {
    message: "Both pagination boundary fields are required together.",
  });
export const listingQueuePage = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.uuid(),
            title: z.string(),
            description: z.string(),
            city: z.string(),
            organizationId: z.uuid(),
            kind: z.enum(["movie", "event", "sports"]),
            state: z.literal("submitted"),
            version: z.number().int().positive(),
            createdAt: z.iso.datetime({ precision: 6 }),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z
      .object({
        afterCreatedAt: z.iso.datetime({ precision: 6 }),
        afterId: z.uuid(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export const listingReviewInput = z
  .object({
    version: z.number().int().positive().max(2147483646),
    state: z.enum(["published", "changes_requested"]),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();
