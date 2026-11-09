import { z } from "zod";
export const notificationFilters = z
  .object({
    after: z.uuid().optional(),
    unread: z.enum(["true", "false"]).optional(),
  })
  .strict();
export const notificationPage = z
  .object({
    unreadCount: z.number().int().nonnegative(),
    items: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          body: z.string(),
          href: z.string(),
          occurred_at: z.iso.datetime(),
          created_at: z.iso.datetime(),
          read_at: z.iso.datetime().nullable(),
        })
        .strict(),
    ),
    nextCursor: z.uuid().nullable(),
    serverTime: z.iso.datetime(),
  })
  .strict();

export const notificationReadMany = z
  .object({ ids: z.array(z.uuid()).min(1).max(20) })
  .strict()
  .refine(
    (input) =>
      new Set(input.ids.map((id) => id.toLowerCase())).size ===
      input.ids.length,
    "Select each notification only once.",
  );
export const notificationReadManyResponse = z
  .object({ ids: z.array(z.uuid()).min(1).max(20), read: z.literal(true) })
  .strict();
export const notificationReadResponse = z
  .object({ id: z.uuid(), read_at: z.iso.datetime().nullable() })
  .strict();
