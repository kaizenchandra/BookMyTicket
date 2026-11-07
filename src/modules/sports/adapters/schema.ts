import { z } from "zod";
const text = (n: number) => z.string().trim().min(1).max(n);
export const fixtureInput = z
  .object({
    title: text(200),
    city: text(100),
    description: text(10000),
    posterUrl: z
      .string()
      .regex(/^(https:\/\/|\/demo\/[a-z0-9-]+\.svg$)/)
      .max(2000)
      .optional(),
    sport: text(100),
    competition: text(200),
    season: text(100),
    homeTeam: text(200),
    awayTeam: text(200),
    entryInstructions: text(2000),
    hospitality: text(2000),
  })
  .strict();
