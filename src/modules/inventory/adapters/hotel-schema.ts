import { z } from "zod";
const reason = z.string().trim().min(10).max(1000),
  version = z.number().int().positive(),
  amount = z.string().regex(/^(0|[1-9]\d{0,8})$/),
  day = z.iso.date();
export const hotelRoomInput = z
  .object({
    code: z.string().regex(/^[a-z][a-z0-9_-]{1,59}$/),
    name: z.string().trim().min(2).max(100),
    maxGuests: z.number().int().min(1).max(20),
    reason,
  })
  .strict();
export const hotelRoomEdit = hotelRoomInput
  .omit({ code: true })
  .extend({ expectedVersion: version, active: z.boolean() });
export const hotelPlanInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    refundable: z.boolean(),
    policy: z.string().trim().min(10).max(3000),
    basePaise: amount,
    includedGuests: z.number().int().min(1).max(20),
    extraGuestPaise: amount,
    minStay: z.number().int().min(1).max(60),
    active: z.boolean(),
    expectedVersion: version,
    reason,
  })
  .strict();
export const hotelPlanEdit = hotelPlanInput.extend({ planVersion: version });
const dates = { from: day, until: day };
function range(x: { from: string; until: string }) {
  return (
    x.until > x.from &&
    (Date.parse(x.until) - Date.parse(x.from)) / 86400000 <= 366
  );
}
export const hotelCalendarQuery = z
  .object({ ...dates, planId: z.uuid() })
  .strict()
  .refine(range, "Choose 1–366 nights, end exclusive");
export const hotelBulkInput = z
  .object({
    ...dates,
    planId: z.uuid(),
    expectedVersion: version,
    capacity: z.number().int().min(0).max(10000),
    stopSell: z.boolean(),
    blackout: z.boolean(),
    basePaise: amount,
    discountBps: z.number().int().min(0).max(10000),
    minStay: z.number().int().min(1).max(60),
    reason,
  })
  .strict()
  .refine(range, "Choose 1–366 nights, end exclusive");
export const hotelHoldInput = z
  .object({
    planId: z.uuid(),
    checkIn: day,
    checkOut: day,
    quantity: z.number().int().min(1).max(20),
    guestsPerRoom: z.number().int().min(1).max(20),
    reason,
  })
  .strict()
  .refine(
    (x) =>
      x.checkOut > x.checkIn &&
      (Date.parse(x.checkOut) - Date.parse(x.checkIn)) / 86400000 <= 60,
    "Choose 1–60 nights",
  );
export const hotelAllocationAction = z
  .object({ action: z.enum(["reserve", "release"]), reason })
  .strict();
export const hotelInventoryKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const hotelHistoryQuery = z
  .object({
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .optional(),
  })
  .strict();
export const hotelReconciliationInput = z
  .object({
    ...dates,
    planId: z.uuid(),
    expectedVersion: version,
    observedCapacity: z.number().int().min(0).max(10000),
    reason,
  })
  .strict()
  .refine(range, "Choose 1–366 nights, end exclusive");
export const hotelRoomResponse = z.object({
  id: z.uuid(),
  property_id: z.uuid(),
  code: z.string(),
  name: z.string(),
  max_guests: z.number().int(),
  active: z.boolean(),
  version: z.number().int(),
});
export const hotelPlanResponse = z.object({
  id: z.uuid(),
  room_id: z.uuid(),
  name: z.string(),
  refundable: z.boolean(),
  policy: z.string(),
  base_paise: z.string(),
  included_guests: z.number().int(),
  extra_guest_paise: z.string(),
  min_stay: z.number().int(),
  active: z.boolean(),
  version: z.number().int(),
});
export const hotelRoomsResponse = z.object({
  items: z.array(
    hotelRoomResponse.extend({ plans: z.array(hotelPlanResponse) }),
  ),
});
export const hotelCalendarResponse = z.object({
  room: hotelRoomResponse,
  plan: hotelPlanResponse,
  currency: z.literal("INR"),
  timeZone: z.literal("Asia/Kolkata"),
  nights: z
    .array(
      z.object({
        day: z.string(),
        capacity: z.number().int().nullable(),
        used: z.number().int(),
        stop_sell: z.boolean(),
        blackout: z.boolean(),
        base_paise: z.string(),
        discount_bps: z.number().int(),
        min_stay: z.number().int(),
      }),
    )
    .max(366),
});
export const hotelQuoteResponse = z.object({
  currency: z.literal("INR"),
  planVersion: z.number().int(),
  roomVersion: z.number().int(),
  refundable: z.boolean(),
  policy: z.string(),
  nights: z.array(
    z.object({
      day: z.string(),
      basePaise: z.string(),
      discountBps: z.number().int(),
      totalPaise: z.string(),
    }),
  ),
  totalPaise: z.string(),
  bookingCreated: z.literal(false),
});
export const hotelAllocationResponse = z.object({
  id: z.uuid(),
  sequence: z.string(),
  room_id: z.uuid(),
  plan_id: z.uuid(),
  owner_id: z.uuid(),
  check_in: z.string(),
  check_out: z.string(),
  quantity: z.number().int(),
  guests_per_room: z.number().int(),
  state: z.enum(["held", "reserved", "released", "expired"]),
  expires_at: z.string(),
  quote: hotelQuoteResponse,
  created_at: z.string(),
  fresh: z.boolean().optional(),
  effective_state: z
    .enum(["held", "reserved", "released", "expired"])
    .optional(),
});
export const hotelAllocationsResponse = z.object({
  items: z.array(hotelAllocationResponse).max(25),
  nextBefore: z.string().nullable(),
});
export const hotelChangesResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        room_id: z.uuid(),
        actor_id: z.uuid(),
        action: z.string(),
        reason: z.string(),
        details: z.unknown(),
        created_at: z.string(),
      }),
    )
    .max(25),
  nextBefore: z.string().nullable(),
});
