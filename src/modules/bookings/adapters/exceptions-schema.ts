import { z } from "zod";
export const exceptionInput = z
  .object({
    action: z.enum(["open", "assign", "escalate", "resolve", "reopen"]),
    expectedVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(10).max(1000),
    assignedTo: z.uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (i) =>
      i.action === "assign"
        ? i.assignedTo !== undefined
        : i.assignedTo === undefined,
    "Specify assignedTo only for assignment (null to unassign).",
  );
export const exceptionKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const exceptionHistory = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .optional(),
  })
  .strict();
export const exceptionResponse = z.object({
  order_id: z.uuid(),
  state: z.enum(["open", "escalated", "resolved"]),
  assigned_to: z.uuid().nullable(),
  version: z.number().int().positive(),
  updated_at: z.string(),
});
export const exceptionDetailResponse = z.object({
  exception: exceptionResponse.nullable(),
  history: z.object({
    items: z
      .array(
        z.object({
          id: z.string(),
          order_id: z.uuid(),
          actor_id: z.uuid(),
          action: z.string(),
          reason: z.string(),
          before_data: exceptionResponse.nullable(),
          after_data: exceptionResponse,
          created_at: z.string(),
        }),
      )
      .max(25),
    nextBefore: z.string().nullable(),
  }),
});
