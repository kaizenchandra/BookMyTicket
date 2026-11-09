import { z } from "zod";
export const reviewQueueFilters = z
  .object({
    kind: z
      .union([z.enum(["cinema", "event", "sports"]), z.literal("")])
      .optional(),
    afterCreatedAt: z.iso.datetime({ precision: 6 }).optional(),
    afterId: z.uuid().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.afterCreatedAt) === Boolean(v.afterId), {
    message: "Both pagination boundary fields are required together.",
  });
export const reviewQueuePage = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string(),
            kind: z.enum(["cinema", "event", "sports"]),
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
