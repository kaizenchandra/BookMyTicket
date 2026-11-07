import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const venueInput = z
  .object({
    name: text(200),
    address: text(1000),
    city: text(100),
    timeZone: text(80),
    amenities: z.string().max(2000),
    accessibility: z.string().max(2000),
  })
  .strict();
export const spaceInput = z
  .object({
    name: text(100),
    kind: z.enum(["screen", "auditorium", "stadium", "hall"]),
    physicalCapacity: z.number().int().min(1).max(100000),
    turnaroundMinutes: z.number().int().min(0).max(1440),
  })
  .strict();
export const planInput = z
  .object({
    label: text(100),
    expectedVersion: z.number().int().positive(),
    configuration: z
      .object({
        orientation: text(200),
        resources: z
          .array(
            z
              .object({
                id: text(100),
                kind: z.enum(["seat", "pool"]),
                label: text(100),
                section: text(100),
                row: z.string().max(100),
                gate: z.string().max(100),
                capacity: z.number().int().min(1).max(100000),
                x: z.number().min(0).max(100),
                y: z.number().min(0).max(100),
                accessible: z.boolean(),
                companionOf: text(100).optional(),
              })
              .strict(),
          )
          .min(1)
          .max(1000),
      })
      .strict(),
  })
  .strict();
export const scheduleInput = z
  .object({
    demo: z.boolean().optional(),
    organizationId: z.uuid(),
    listingId: z.uuid(),
    planId: z.uuid(),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    salesOpen: z.iso.datetime({ offset: true }),
    salesClose: z.iso.datetime({ offset: true }),
    prices: z.record(z.string(), z.number().int().min(0).max(100000000)),
  })
  .strict();
