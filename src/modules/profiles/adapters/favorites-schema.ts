import { z } from "zod";
export const favoriteFilters = z
  .object({ after: z.uuid().optional() })
  .strict();
export const favoriteState = z.object({ saved: z.boolean() }).strict();
export const favoritePage = z
  .object({
    items: z
      .array(
        z
          .object({
            listingId: z.uuid(),
            savedAt: z.iso.datetime(),
            listing: z
              .object({
                id: z.uuid(),
                title: z.string(),
                kind: z.enum(["movie", "event", "sports"]),
                city: z.string(),
                poster_url: z.string().nullable(),
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
export type FavoritePage = z.infer<typeof favoritePage>;
