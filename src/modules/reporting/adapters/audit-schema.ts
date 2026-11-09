import { z } from "zod";
export const auditFilters = z
  .object({
    actor: z.uuid().optional(),
    action: z.string().trim().min(1).max(200).optional(),
    target: z.string().trim().min(1).max(200).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    after: z.string().min(1).max(2000).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.from) < Date.parse(f.until),
    "The end must be after the start.",
  );

export const auditPage = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string(),
          actor_id: z.uuid().nullable(),
          action: z.string(),
          target: z.string(),
          created_at: z.iso.datetime({ offset: true }),
          outcome: z.enum(["success", "failure", "denied", "not_recorded"]),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
    serverTime: z.iso.datetime(),
  })
  .strict();
