import { venueImageSchema } from "./schemas.ts";
import { z } from "zod";
export const publicVenueFilters = z
  .object({ after: z.string().min(1).max(2000).optional() })
  .strict();
export const publicVenuePage = z
  .object({
    venue: z
      .object({
        media: z.array(venueImageSchema).max(8),
        contact: z
          .object({ phone: z.string(), email: z.string() })
          .strict()
          .nullable(),
        id: z.uuid(),
        name: z.string(),
        address: z.string(),
        city: z.string(),
        timeZone: z.string(),
        amenities: z.string(),
        accessibility: z.string(),
        transportGuidance: z.string(),
        parkingGuidance: z.string(),
        entryPolicies: z.string(),
      })
      .strict(),
    items: z.array(
      z
        .object({
          id: z.uuid(),
          listingId: z.uuid(),
          title: z.string(),
          kind: z.enum(["movie", "event", "sports"]),
          startsAt: z.iso.datetime(),
          timeZone: z.string(),
          spaceName: z.string(),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
  })
  .strict();
