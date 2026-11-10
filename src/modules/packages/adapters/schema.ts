import { z } from "zod";
const text = z.string().trim().min(1).max(300),
  long = z.string().trim().max(10000),
  amount = z.string().regex(/^(0|[1-9]\d{0,11})$/),
  key = z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/);
export const packageDefinition = z
  .object({
    name: text,
    description: long,
    destinations: z.array(text).max(30),
    itinerary: z
      .array(
        z
          .object({
            day: z.number().int().min(1).max(60),
            title: text,
            description: long,
          })
          .strict(),
      )
      .max(60),
    inclusions: z.array(text).max(50),
    exclusions: z.array(text).max(50),
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
              }, "Use HTTPS without credentials"),
            alt: text,
          })
          .strict(),
      )
      .max(30),
    departures: z
      .array(z.object({ start: z.iso.date(), end: z.iso.date() }).strict())
      .max(100),
    maxAdults: z.number().int().min(1).max(50),
    maxChildren: z.number().int().min(0).max(50),
    maxGuests: z.number().int().min(1).max(50),
    childMaxAge: z.number().int().min(0).max(17),
    childPolicy: long,
    cancellationPolicy: long,
    components: z
      .array(
        z
          .object({
            id: key,
            name: text,
            kind: z.enum(["hotel", "transport", "activity", "other"]),
            supplierReference: text,
            adultPaise: amount,
            childPaise: amount,
            fixedPaise: amount,
          })
          .strict(),
      )
      .max(30),
    addons: z
      .array(
        z
          .object({
            id: key,
            name: text,
            pricePaise: amount,
            basis: z.enum(["person", "booking"]),
          })
          .strict(),
      )
      .max(30),
    markupBps: z.number().int().min(0).max(10000),
    feePaise: amount,
  })
  .strict();
const reason = z.string().trim().min(10).max(1000),
  version = z.number().int().positive();
export const packageCreate = z
  .object({ code: key, content: packageDefinition, reason })
  .strict();
export const packageEdit = z
  .object({ content: packageDefinition, expectedVersion: version, reason })
  .strict();
export const packageAction = z
  .object({
    action: z.enum(["submit", "approve", "reject", "unpublish"]),
    expectedVersion: version,
    reason,
  })
  .strict();
export const packageFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    state: z.enum(["draft", "pending_review", "published"]).optional(),
    destination: z.string().trim().max(300).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict();
export const packagePreview = z
  .object({
    departure: z.iso.date(),
    adults: z.number().int().min(1).max(50),
    childAges: z.array(z.number().int().min(0).max(17)).max(50),
    addonIds: z
      .array(key)
      .max(30)
      .refine((x) => new Set(x).size === x.length, "Duplicate add-on"),
  })
  .strict();
export const packageAllotment = z
  .object({
    departure: z.iso.date(),
    expectedVersion: version,
    allotmentVersion: z.number().int().nonnegative(),
    capacity: z.number().int().min(0).max(10000),
    components: z
      .array(
        z
          .object({ id: key, capacity: z.number().int().min(0).max(10000) })
          .strict(),
      )
      .max(30),
    reason,
  })
  .strict();
export const packageKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const packageHistoryQuery = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .refine((v) => BigInt(v) <= 9223372036854775807n)
      .optional(),
  })
  .strict();
const record = z.object({
  id: z.uuid(),
  code: z.string(),
  content: packageDefinition,
  state: z.enum(["draft", "pending_review", "published"]),
  version: z.number().int(),
  created_at: z.string(),
});
const complete = z.object({
  complete: z.boolean(),
  missing: z.array(z.string()),
});
const allotmentResponse = z.object({
  departure: z.string(),
  definitionVersion: z.number().int(),
  version: z.number().int(),
  capacity: z.number().int(),
  components: z.array(z.object({ id: z.string(), capacity: z.number().int() })),
});
export const packagePageResponse = z.object({
  items: z.array(record.extend({ completeness: complete })).max(25),
  nextCursor: z.string().nullable(),
});
export const packageDetailResponse = record.extend({
  completeness: complete,
  allotments: z.array(allotmentResponse),
  fulfillment: z.object({
    state: z.literal("not_configured"),
    bookable: z.literal(false),
    confirmations: z.null(),
    message: z.string(),
  }),
});
const publicDefinition = packageDefinition
  .omit({ components: true, addons: true, markupBps: true, feePaise: true })
  .extend({
    components: z.array(
      packageDefinition.shape.components.element.pick({
        id: true,
        name: true,
        kind: true,
      }),
    ),
    addons: z.array(
      packageDefinition.shape.addons.element.pick({
        id: true,
        name: true,
        basis: true,
      }),
    ),
  });
export const packagePublishedResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        code: z.string(),
        content: publicDefinition,
        bookable: z.literal(false),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
const priceLine = z.object({
  id: z.string(),
  name: z.string(),
  amountPaise: z.string(),
});
export const packagePriceResponse = z.object({
  currency: z.literal("INR"),
  components: z.array(priceLine),
  addons: z.array(priceLine),
  markupPaise: z.string(),
  feePaise: z.string(),
  totalPaise: z.string(),
  bookable: z.literal(false),
  definitionVersion: z.number().int(),
  departure: z.string(),
  planningLimit: z.number().int().nullable(),
  withinPlanningLimit: z.boolean().nullable(),
  availability: z.literal("unknown"),
  supplierConfirmations: z.null(),
});
export const packageHistoryResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        package_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        snapshot: z.unknown(),
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.string().nullable(),
});
