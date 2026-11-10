import {
  paymentMilestoneKinds,
  paymentHistoryCategories,
} from "../../payments/contracts/history.ts";
import { z } from "zod";
export const paymentHistoryFilters = z
  .object({
    after: z.string().min(1).max(2000).optional(),
    category: z.enum(paymentHistoryCategories).optional(),
    attemptId: z
      .uuid()
      .transform((value) => value.toLowerCase())
      .optional(),
  })
  .strict()
  .refine(
    (value) => !value.attemptId || value.category === "attempts",
    "Use the attempts category when filtering by attempt reference.",
  );
export const paymentHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.uuid(),
            kind: z.enum(paymentMilestoneKinds),
            occurredAt: z.iso.datetime(),
            attemptId: z.uuid().nullable().optional(),
            amountPaise: z.number().int().positive(),
            currency: z.literal("INR"),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.string().nullable(),
  })
  .strict();
