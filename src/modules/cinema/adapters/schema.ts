import { z } from "zod";
const text = (n: number) => z.string().trim().min(1).max(n);
export const movieInput = z
  .object({
    title: text(200),
    city: text(100),
    description: text(10000),
    posterUrl: z
      .string()
      .regex(/^(https:\/\/|\/demo\/[a-z0-9-]+\.svg$)/)
      .max(2000)
      .optional(),
    durationMinutes: z.number().int().min(1).max(600),
    releaseDate: z.iso.date(),
    certification: z.enum([
      "U",
      "UA 7+",
      "UA 13+",
      "UA 16+",
      "A",
      "S",
      "Unrated (demo)",
    ]),
    genre: text(100),
    language: text(100),
    format: text(100),
    cast: text(1000),
    crew: text(1000),
  })
  .strict();
