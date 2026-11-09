import { z } from "zod";
import type { WalletView } from "../contracts/wallet.ts";
export const walletResponse: z.ZodType<WalletView> = z
  .object({
    orderId: z.string().uuid(),
    bookingState: z.string(),
    serverTime: z.iso.datetime(),
    issuance: z.enum(["not_confirmed", "pending", "issued"]),
    instructions: z.string(),
    occurrences: z.array(
      z
        .object({
          id: z.string().uuid(),
          venueName: z.string(),
          venueAddress: z.string().nullable(),
          venueCity: z.string().nullable(),
          directionsUrl: z.url().max(2048).nullable(),
          timeZone: z.string(),
          startsAt: z.iso.datetime(),
          endsAt: z.iso.datetime(),
          state: z.string(),
          version: z.number().int(),
          resources: z.array(
            z
              .object({
                id: z.string(),
                label: z.string(),
                gate: z.string().optional(),
              })
              .strict(),
          ),
          admissionOpensAt: z.iso.datetime(),
          scheduleChanged: z.boolean(),
        })
        .strict(),
    ),
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          occurrenceId: z.string().uuid(),
          resource: z.string(),
          label: z.string(),
          gate: z.string().nullable(),
          ordinal: z.number().int().nonnegative(),
          status: z.string(),
          remaining: z.number().int().nonnegative(),
          qrSvg: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
