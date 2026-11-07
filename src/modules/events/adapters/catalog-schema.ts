import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const eventInput = z
  .object({
    title: text(200),
    city: text(100),
    description: text(10000),
    posterUrl: z
      .string()
      .regex(/^(https:\/\/|\/demo\/[a-z0-9-]+\.svg$)/)
      .max(2000)
      .optional(),
    performers: text(1000),
    organizer: text(200),
    durationMinutes: z.number().int().min(1).max(1440),
    minimumAge: z.number().int().min(0).max(100),
    genre: text(100),
    language: text(100),
    inclusions: text(2000),
    exclusions: text(2000),
    entryInstructions: text(2000),
  })
  .strict();
