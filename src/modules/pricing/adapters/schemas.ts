import { z } from "zod";
const amount = z.number().int().min(0).max(1_000_000_000);
const tax = z
  .object({
    basisPoints: z.number().int().min(0).max(10000),
    mode: z.enum(["inclusive", "exclusive"]),
  })
  .strict();
export const commercialPolicySchema = z
  .object({
    allowFreeBookings: z.boolean().optional(),
    freeCancellationCutoffMinutes: z
      .number()
      .int()
      .min(0)
      .max(525600)
      .optional(),
    feePerOrderPaise: amount,
    feePerTicketPaise: amount,
    feeBasisPoints: z.number().int().min(0).max(10000),
    ticketTax: tax,
    feeTax: tax,
    cancellationTerms: z.string().trim().min(10).max(10000),
    admissionTerms: z.string().trim().min(10).max(10000),
  })
  .strict();
export const policyInputSchema = z
  .object({
    label: z.string().trim().min(2).max(150),
    reason: z.string().trim().min(5).max(2000),
    configuration: commercialPolicySchema,
  })
  .strict();
export const quoteInputSchema = z
  .object({ reservationId: z.string().uuid() })
  .strict();
export const placementInputSchema = z
  .object({
    registration: z
      .object({
        formId: z.string().uuid(),
        answers: z
          .array(
            z.record(
              z.string().max(40),
              z.union([z.string().max(500), z.boolean()]),
            ),
          )
          .min(1)
          .max(8),
      })
      .strict()
      .optional(),
    reservationId: z.string().uuid(),
    quoteId: z.string().uuid(),
    acceptPolicies: z.boolean(),
  })
  .strict();
export const assignmentInputSchema = z
  .object({
    policyId: z.string().uuid(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();
const unitPriceSchema = z
  .object({
    key: z.string(),
    occurrenceId: z.string().uuid(),
    resourceId: z.string(),
    ordinal: z.number().int().min(0),
    ticketBasePaise: amount,
    feeBasePaise: amount,
    ticketTaxPaise: amount,
    feeTaxPaise: amount,
    totalPaise: amount,
  })
  .strict();
export const quoteResponseSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string().uuid(),
    reservationId: z.string().uuid(),
    policyId: z.string().uuid(),
    policyLabel: z.string(),
    policy: commercialPolicySchema,
    prices: z
      .object({
        currency: z.literal("INR"),
        units: z.array(unitPriceSchema).min(1).max(8),
        ticketSubtotalPaise: amount,
        feesPaise: amount,
        taxesPaise: amount,
        discountPaise: amount,
        extrasPaise: amount,
        totalPaise: amount,
      })
      .strict(),
    expiresAt: z.iso.datetime(),
    serverTime: z.iso.datetime(),
    version: z.literal(1),
    reservationSnapshot: z
      .object({
        id: z.string().uuid(),
        expires_at: z.iso.datetime(),
        items: z.array(
          z
            .object({
              occurrence_id: z.string().uuid(),
              resource_id: z.string(),
              quantity: z.number().int().positive(),
              unit_price_paise: amount,
            })
            .strict(),
        ),
        occurrences: z.array(
          z
            .object({
              id: z.string().uuid(),
              listingId: z.string().uuid(),
              title: z.string().optional(),
              isDemo: z.boolean().optional(),
              venueName: z.string(),
              timeZone: z.string(),
              startsAt: z.iso.datetime(),
              endsAt: z.iso.datetime(),
            })
            .strict(),
        ),
        subtotalPaise: amount,
        currency: z.literal("INR"),
      })
      .strict(),
  })
  .strict();
