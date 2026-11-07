import { z } from "zod";
export const onlineSettings = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    url: z
      .url()
      .max(2000)
      .refine((value) => {
        const u = new URL(value);
        return u.protocol === "https:" && !u.username && !u.password;
      }, "Use an HTTPS joining URL without embedded credentials.")
      .optional(),
    opensAt: z.iso.datetime({ offset: true }),
    closesAt: z.iso.datetime({ offset: true }),
    enabled: z.boolean(),
  })
  .strict();
