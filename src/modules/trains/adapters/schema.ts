import { z } from "zod";
export const trainKind = z.enum(["stations", "routes", "services"]);
const name = z.string().trim().min(2).max(150),
  reason = z.string().trim().min(10).max(1000),
  code = z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/);
export const trainStation = z
  .object({
    name,
    stationCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{1,12}$/),
    city: name,
    active: z.boolean(),
  })
  .strict();
const stop = z
  .object({
    stationId: z.uuid(),
    arrivalMinutes: z.number().int().min(0).max(10080),
    departureMinutes: z.number().int().min(0).max(10080),
    boarding: z.boolean(),
    alighting: z.boolean(),
  })
  .strict();
export const trainRoute = z
  .object({ name, stops: z.array(stop).min(2).max(120), active: z.boolean() })
  .strict();
export const trainService = z
  .object({
    name,
    trainNumber: z.string().regex(/^[0-9]{1,10}$/),
    routeId: z.uuid(),
    departure: z.iso.datetime({ offset: true }),
    arrival: z.iso.datetime({ offset: true }),
    classes: z
      .array(
        z.object({ code: z.string().regex(/^[A-Z0-9]{1,12}$/), name }).strict(),
      )
      .min(1)
      .max(30),
    providerReference: z.string().trim().max(200),
    operationalNotes: z.string().trim().max(3000),
  })
  .strict();
export const trainCreate = {
  stations: z.object({ code, content: trainStation, reason }).strict(),
  routes: z.object({ code, content: trainRoute, reason }).strict(),
  services: z.object({ code, content: trainService, reason }).strict(),
};
export const trainEdit = {
  stations: trainCreate.stations
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
  routes: trainCreate.routes
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
  services: trainCreate.services
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
};
export const trainFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z
      .enum(["active", "suspended", "planned", "disrupted", "withdrawn"])
      .optional(),
    trainNumber: z
      .string()
      .regex(/^[0-9]{1,10}$/)
      .optional(),
    routeId: z.uuid().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    until: z.iso.datetime({ offset: true }).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict()
  .refine(
    (f) => !f.from || !f.until || Date.parse(f.from) < Date.parse(f.until),
    "End must follow start",
  );
export const trainIncident = z
  .object({
    action: z.enum(["disrupt", "resolve", "withdraw"]),
    expectedVersion: z.number().int().positive(),
    reason,
  })
  .strict();
export const trainKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const trainHistoryQuery = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .refine((s) => BigInt(s) <= 9223372036854775807n)
      .optional(),
  })
  .strict();
const routeResponse = trainRoute.extend({
  stops: z.array(
    stop.extend({
      station: z.object({
        name: z.string(),
        code: z.string(),
        city: z.string(),
      }),
    }),
  ),
});
const base = z.object({
  id: z.uuid(),
  code: z.string(),
  status: z.string(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export const trainRecordResponse = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("stations"), content: trainStation }),
  base.extend({ kind: z.literal("routes"), content: routeResponse }),
  base.extend({
    kind: z.literal("services"),
    content: trainService.extend({ routeSnapshot: routeResponse }),
  }),
]);
export const trainPageResponse = z.object({
  items: z.array(trainRecordResponse).max(25),
  nextCursor: z.string().nullable(),
});
export const trainDetailResponse = z.object({
  record: trainRecordResponse,
  integration: z.object({
    state: z.literal("not_configured"),
    bookable: z.literal(false),
    availability: z.null(),
    fare: z.null(),
    pnr: z.null(),
    bookingStatus: z.null(),
    waitlistStatus: z.null(),
    cancellationStatus: z.null(),
    refundStatus: z.null(),
    message: z.string(),
  }),
});
export const trainHistoryResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        record_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        before_data: trainRecordResponse.nullable(),
        after_data: trainRecordResponse,
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.string().nullable(),
});
