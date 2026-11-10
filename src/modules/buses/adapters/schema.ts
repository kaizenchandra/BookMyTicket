import { z } from "zod";
export const busKind = z.enum(["operators", "routes", "services"]);
const name = z.string().trim().min(2).max(150),
  reason = z.string().trim().min(10).max(1000),
  code = z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/);
export const busOperator = z
  .object({
    name,
    contactEmail: z.email().max(254),
    contactPhone: z.string().regex(/^\+?[0-9 ()-]{7,25}$/),
    supplierName: name,
    supplierReference: z.string().trim().min(1).max(150),
    active: z.boolean(),
  })
  .strict();
const stop = z
  .object({
    name,
    address: z.string().trim().min(5).max(500),
    offsetMinutes: z.number().int().min(0).max(10080),
  })
  .strict();
export const busRoute = z
  .object({
    name,
    origin: name,
    destination: name,
    boarding: z.array(stop).min(1).max(30),
    dropping: z.array(stop).min(1).max(30),
    active: z.boolean(),
  })
  .strict();
export const busService = z
  .object({
    name,
    operatorId: z.uuid(),
    routeId: z.uuid(),
    departure: z.iso.datetime({ offset: true }),
    arrival: z.iso.datetime({ offset: true }),
    amenities: z.array(z.string().trim().min(1).max(100)).max(30),
    seats: z
      .array(
        z
          .object({
            label: z
              .string()
              .trim()
              .regex(/^[A-Za-z0-9_-]{1,12}$/),
            deck: z.enum(["lower", "upper"]),
            row: z.number().int().min(1).max(30),
            column: z.number().int().min(1).max(6),
            type: z.enum(["seater", "sleeper"]),
            farePaise: z.string().regex(/^(0|[1-9]\d{0,8})$/),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    cancellationPolicy: z.string().trim().min(10).max(3000),
    freeCancellationHours: z.number().int().min(0).max(8760),
    penaltyBps: z.number().int().min(0).max(10000),
  })
  .strict();
export const busCreate = {
  operators: z.object({ code, content: busOperator, reason }).strict(),
  routes: z.object({ code, content: busRoute, reason }).strict(),
  services: z.object({ code, content: busService, reason }).strict(),
};
export const busEdit = {
  operators: busCreate.operators
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
  routes: busCreate.routes
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
  services: busCreate.services
    .omit({ code: true })
    .extend({ expectedVersion: z.number().int().positive() }),
};
export const busFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z
      .enum(["active", "suspended", "planned", "disrupted", "withdrawn"])
      .optional(),
    operatorId: z.uuid().optional(),
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
export const busDisruption = z
  .object({
    action: z.enum(["disrupt", "resolve", "withdraw"]),
    expectedVersion: z.number().int().positive(),
    reason,
  })
  .strict();
export const busKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const busHistoryQuery = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .optional(),
  })
  .strict();
const busBase = z.object({
  id: z.uuid(),
  code: z.string(),
  status: z.string(),
  version: z.number().int().positive(),
  created_at: z.string(),
});
export const busRecordResponse = z.discriminatedUnion("kind", [
  busBase.extend({ kind: z.literal("operators"), content: busOperator }),
  busBase.extend({ kind: z.literal("routes"), content: busRoute }),
  busBase.extend({
    kind: z.literal("services"),
    content: busService.extend({ routeSnapshot: busRoute }),
  }),
]);
export const busPageResponse = z.object({
  items: z.array(busRecordResponse).max(25),
  nextCursor: z.string().nullable(),
});
export const busDetailResponse = z.object({
  record: busRecordResponse,
  integration: z.object({
    state: z.literal("not_configured"),
    availability: z.null(),
    bookedSeats: z.null(),
    bookingStatus: z.null(),
    ticketStatus: z.null(),
    message: z.string(),
  }),
});
export const busHistoryResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        record_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        before_data: busRecordResponse.nullable(),
        after_data: busRecordResponse,
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.string().nullable(),
});
