import { z } from "zod";
const notificationDate = z.iso
  .date()
  .refine((v) => !v.startsWith("0000"), "Use a year from 0001 onward.");
export const notificationFilters = z
  .object({
    after: z.uuid().optional(),
    fromDate: notificationDate.optional(),
    toDate: notificationDate.optional(),
    unread: z.enum(["true", "false"]).optional(),
    status: z.enum(["all", "unread", "read"]).optional(),
    category: z.enum(["booking", "payment", "support"]).optional(),
  })
  .strict()
  .refine((v) => v.status === undefined || v.unread === undefined, {
    message: "Use status or the legacy unread filter, not both.",
  })
  .refine((v) => !v.fromDate || !v.toDate || v.fromDate <= v.toDate, {
    message: "From date must not follow to date.",
  });
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

export const notificationUnreadManyResponse = z
  .object({ ids: z.array(z.uuid()).min(1).max(20), read: z.literal(false) })
  .strict();
