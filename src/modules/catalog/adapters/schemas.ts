import { z } from "zod";
export const listingInput = z
  .object({
    title: z.string().trim().min(2).max(200),
    kind: z.enum(["movie", "event", "sports"]),
    city: z.string().trim().min(2).max(100),
    description: z.string().trim().min(10).max(10000),
    posterUrl: z
      .url()
      .refine((s) => s.startsWith("https://"))
      .optional(),
    metadata: z
      .record(z.string().max(100), z.string().max(1000))
      .refine((m) => Object.keys(m).length <= 50),
  })
  .strict();
export const listingUpdate = listingInput
  .extend({ version: z.number().int().positive() })
  .strict();
export const catalogFilters = z
  .object({
    city: z.string().trim().max(100).optional(),
    kind: z.enum(["movie", "event", "sports"]).optional(),
    q: z.string().trim().max(100).optional(),
    language: z.string().trim().max(1000).optional(),
    genre: z.string().trim().max(1000).optional(),
    format: z.string().trim().max(1000).optional(),
    sort: z.enum(["newest", "title"]).optional(),
    after: z.string().min(1).max(4096).optional(),
  })
  .strict();
export const suggestionFilters = z
  .object({
    q: z.string().trim().min(2).max(100),
    city: z.string().trim().max(100).optional(),
  })
  .strict();
export const catalogSearchResponse = z
  .object({
    items: z.array(
      z
        .object({
          id: z.uuid(),
          title: z.string(),
          kind: z.enum(["movie", "event", "sports"]),
          city: z.string(),
          description: z.string(),
          poster_url: z.string().nullable(),
          metadata: z.record(z.string(), z.string()),
          version: z.number().int(),
        })
        .strict(),
    ),
    total: z.number().int().nonnegative(),
    facets: z
      .object({
        language: z.array(z.string()),
        genre: z.array(z.string()),
        format: z.array(z.string()),
      })
      .strict(),
    nextCursor: z.string().nullable(),
    serverTime: z.iso.datetime(),
  })
  .strict();
