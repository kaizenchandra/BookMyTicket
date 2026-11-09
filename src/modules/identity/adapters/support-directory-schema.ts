import { z } from "zod";
export const supportDirectoryFilters = z
  .object({
    q: z.string().trim().min(3).max(254),
    after: z.string().min(1).max(2000).optional(),
  })
  .strict();
export const supportDirectoryPage = z
  .object({
    items: z.array(z.object({ id: z.uuid(), contact: z.string() }).strict()),
    nextCursor: z.string().nullable(),
  })
  .strict();
