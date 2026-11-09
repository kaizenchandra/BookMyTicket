import { z } from "zod";
export const venueFavoriteFilters = z
  .object({ after: z.uuid().optional() })
  .strict();
export const venueFavoritePage = z
  .object({
    items: z
      .array(
        z
          .object({
            venueId: z.uuid(),
            savedAt: z.iso.datetime(),
            venue: z
              .object({
                id: z.uuid(),
                name: z.string(),
                city: z.string(),
                address: z.string(),
              })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .max(24),
    nextCursor: z.uuid().nullable(),
  })
  .strict();
