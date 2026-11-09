import { z } from "zod";
export const caseFilters = z
  .object({
    after: z.string().min(1).max(2000).optional(),
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

export const assignmentInput = z
  .object({
    version: z.number().int().positive(),
    assigneeId: z.uuid(),
    reason: z.string().trim().min(5).max(2000),
  })
  .strict();

export const escalationInput = z
  .object({
    version: z.number().int().positive(),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict();

export const createCaseInput = z
  .object({
    subject: z.string().trim().min(5).max(150),
    category: z.enum(["booking", "payment", "accessibility", "other"]),
    body: z.string().trim().min(10).max(5000),
    bookingId: z.uuid().optional(),
  })
  .strict();

export const casePage = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          subject: z.string(),
          category: z.string(),
          state: z.enum(["open", "in_progress", "escalated", "resolved"]),
          priority: z.enum(["low", "normal", "high", "urgent"]),
          assigned_to: z.uuid().nullable(),
          version: z.number().int().positive(),
          created_at: z.iso.datetime(),
          updated_at: z.iso.datetime(),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const caseListFilters = z
  .object({
    caseId: z.uuid().optional(),
    after: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (f) => !(f.caseId && f.after),
    "Choose an exact case or a history page, not both.",
  );

export const customerCasePage = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          subject: z.string(),
          category: z.string(),
          state: z.enum(["open", "in_progress", "escalated", "resolved"]),
          version: z.number().int().positive(),
          booking_id: z.uuid().nullable(),
          created_at: z.iso.datetime(),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const messageFilters = z
  .object({ after: z.string().min(1).max(2000).optional() })
  .strict();
export const customerMessagePage = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          audience: z.literal("customer"),
          body: z.string(),
          created_at: z.iso.datetime(),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
  })
  .strict();

// Partial case-detail contract: existing case and booking metadata remain additive.
export const staffCaseDetailPage = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    messages: z.array(
      z
        .object({
          id: z.uuid(),
          audience: z.enum(["customer", "internal"]),
          body: z.string(),
          created_at: z.iso.datetime(),
        })
        .strict(),
    ),
    nextMessageCursor: z.string().nullable(),
  })
  .loose();
