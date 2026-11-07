import { z } from "zod";
export const caseFilters = z
  .object({
    state: z.enum(["open", "in_progress", "escalated", "resolved"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    category: z
      .enum(["booking", "payment", "accessibility", "other"])
      .optional(),
    assignment: z.enum(["mine", "unassigned"]).optional(),
  })
  .strict();
export const caseCommand = z
  .object({
    version: z.number().int().positive(),
    action: z.enum([
      "claim",
      "release",
      "escalate",
      "resolve",
      "reopen",
      "priority",
    ]),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict()
  .refine((v) => v.action !== "priority" || !!v.priority, {
    message: "Priority is required.",
  });
export const staffReply = z
  .object({
    version: z.number().int().positive(),
    audience: z.enum(["customer", "internal"]),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();
