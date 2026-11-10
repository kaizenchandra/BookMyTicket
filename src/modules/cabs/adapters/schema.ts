import { z } from "zod";
export const cabKind = z.enum(["suppliers", "categories", "services"]);
const name = z.string().trim().min(2).max(150),
  reason = z.string().trim().min(10).max(1000),
  code = z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/),
  money = z.string().regex(/^(0|[1-9]\d{0,8})$/),
  meters = z.number().int().min(0).max(5000000);
export const cabSupplier = z
  .object({
    name,
    contactEmail: z.email().max(254),
    contactPhone: z.string().regex(/^\+?[0-9 ()-]{7,25}$/),
    supplierReference: name,
    active: z.boolean(),
  })
  .strict();
export const cabCategory = z
  .object({
    name,
    passengers: z.number().int().min(1).max(50),
    luggage: z.number().int().min(0).max(50),
    amenities: z.string().trim().max(1000),
    active: z.boolean(),
  })
  .strict();
export const cabService = z
  .object({
    name,
    supplierId: z.uuid(),
    categoryId: z.uuid(),
    mode: z.enum(["city", "airport", "outstation"]),
    origin: name,
    destination: name,
    availableFrom: z.iso.datetime({ offset: true }),
    availableUntil: z.iso.datetime({ offset: true }),
    maxDistanceMeters: meters.min(1),
    basePaise: money,
    includedMeters: meters,
    perKmPaise: money,
    includedWaitingMinutes: z.number().int().min(0).max(1440),
    waitingMinutePaise: money,
    driverAllowancePaise: money,
    airportFeePaise: money,
    cancellationPolicy: z.string().trim().min(10).max(3000),
  })
  .strict();
export const cabCreate = {
  suppliers: z.object({ code, content: cabSupplier, reason }).strict(),
  categories: z.object({ code, content: cabCategory, reason }).strict(),
  services: z.object({ code, content: cabService, reason }).strict(),
};
const version = { expectedVersion: z.number().int().positive() };
export const cabEdit = {
  suppliers: cabCreate.suppliers.omit({ code: true }).extend(version),
  categories: cabCreate.categories.omit({ code: true }).extend(version),
  services: cabCreate.services.omit({ code: true }).extend(version),
};
export const cabFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z
      .enum(["active", "suspended", "planned", "disrupted", "withdrawn"])
      .optional(),
    supplierId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.from) < Date.parse(f.until),
    "End must follow start",
  );
export const cabDisruption = z
  .object({
    action: z.enum(["disrupt", "resolve", "withdraw"]),
    ...version,
    reason,
  })
  .strict();
export const cabPreview = z
  .object({
    ...version,
    pickupAt: z.iso.datetime({ offset: true }),
    origin: name,
    destination: name,
    passengers: z.number().int().min(1).max(50),
    luggage: z.number().int().min(0).max(50),
    distanceMeters: meters.min(1),
    durationMinutes: z.number().int().min(1).max(10080),
    waitingMinutes: z.number().int().min(0).max(10080),
  })
  .strict();
export const cabKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const cabHistoryQuery = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .optional(),
  })
  .strict();
const base = z.object({
  id: z.uuid(),
  code: z.string(),
  status: z.string(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export const cabRecordResponse = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("suppliers"), content: cabSupplier }),
  base.extend({ kind: z.literal("categories"), content: cabCategory }),
  base.extend({ kind: z.literal("services"), content: cabService }),
]);
export const cabPageResponse = z.object({
  items: z.array(cabRecordResponse).max(25),
  nextCursor: z.string().nullable(),
});
export const cabDetailResponse = z.object({
  record: cabRecordResponse,
  integration: z.object({
    state: z.literal("not_configured"),
    availability: z.null(),
    reservations: z.null(),
    bookingStatus: z.null(),
    tripStatus: z.null(),
    cancellationStatus: z.null(),
    actualCharges: z.null(),
    reconciliation: z.null(),
    bookable: z.literal(false),
    message: z.string(),
  }),
});
export const cabHistoryResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        record_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        before_data: cabRecordResponse.nullable(),
        after_data: cabRecordResponse,
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.string().nullable(),
});
export const cabPriceResponse = z.object({
  currency: z.literal("INR"),
  lines: z.array(z.object({ label: z.string(), paise: z.string() })),
  totalPaise: z.string(),
  chargeableMeters: z.number(),
  distanceMeters: z.number(),
  durationMinutes: z.number(),
  waitingMinutes: z.number(),
  bookable: z.literal(false),
  availability: z.null(),
  exclusions: z.array(z.string()),
  basis: z.string(),
  serviceId: z.uuid(),
  serviceVersion: z.number(),
  categoryVersion: z.number(),
});
