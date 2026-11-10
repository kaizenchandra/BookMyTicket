import { z } from "zod";
const text = z.string().trim().max(300),
  long = z.string().trim().max(10000),
  clock = z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .or(z.literal(""));
export const propertyContent = z
  .object({
    name: text,
    kind: z.enum(["hotel", "homestay"]),
    description: long,
    city: text,
    address: z.string().trim().max(1000),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    contactEmail: z.email().max(254).or(z.literal("")),
    contactPhone: z
      .string()
      .regex(/^\+?[0-9 ()-]{7,25}$/)
      .or(z.literal("")),
    supplier: z.object({ name: text, reference: text }).strict(),
    images: z
      .array(
        z
          .object({
            url: z
              .url()
              .max(2000)
              .refine((v) => {
                const u = new URL(v);
                return u.protocol === "https:" && !u.username && !u.password;
              }, "Use an HTTPS image URL without credentials"),
            alt: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(30),
    amenities: z.array(text.min(1)).max(50),
    facilities: z.array(text.min(1)).max(50),
    houseRules: long,
    checkIn: clock,
    checkOut: clock,
    cancellationPolicy: long,
  })
  .strict();
const reason = z.string().trim().min(10).max(1000);
export const propertyCreate = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/),
    content: propertyContent,
    reason,
  })
  .strict();
export const propertyEdit = z
  .object({
    content: propertyContent,
    expectedVersion: z.number().int().positive(),
    reason,
  })
  .strict();
export const propertyAction = z
  .object({
    action: z.enum([
      "submit",
      "approve",
      "reject",
      "suspend",
      "delist",
      "reopen",
    ]),
    expectedVersion: z.number().int().positive(),
    reason,
  })
  .strict();
export const propertyFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    city: text.optional(),
    kind: z.enum(["hotel", "homestay"]).optional(),
    state: z
      .enum(["draft", "pending_review", "published", "suspended", "delisted"])
      .optional(),
    after: z.string().max(1500).optional(),
    south: z.coerce.number().min(-90).max(90).optional(),
    north: z.coerce.number().min(-90).max(90).optional(),
    west: z.coerce.number().min(-180).max(180).optional(),
    east: z.coerce.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine(
    (f) =>
      [f.south, f.north, f.west, f.east].every((x) => x === undefined) ||
      ([f.south, f.north, f.west, f.east].every((x) => x !== undefined) &&
        f.south! <= f.north! &&
        f.west! <= f.east!),
    "Supply all four bounding coordinates in increasing order",
  );
export const propertyRequestKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
const record = z.object({
  id: z.uuid(),
  code: z.string(),
  content: propertyContent,
  state: z.enum([
    "draft",
    "pending_review",
    "published",
    "suspended",
    "delisted",
  ]),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export const propertyResponse = record.extend({
  completeness: z.object({
    complete: z.boolean(),
    missing: z.array(z.string()),
  }),
});
export const propertyPage = z.object({
  items: z.array(propertyResponse).max(25),
  nextCursor: z.string().nullable(),
});
export const publishedPropertyPage = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        code: z.string(),
        version: z.number().int(),
        content: propertyContent.omit({
          contactEmail: true,
          contactPhone: true,
          supplier: true,
        }),
        bookable: z.literal(false),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
export const propertyHistory = z.object({
  items: z
    .array(
      z.object({
        version: z.number().int(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        snapshot: record,
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.number().int().nullable(),
});
