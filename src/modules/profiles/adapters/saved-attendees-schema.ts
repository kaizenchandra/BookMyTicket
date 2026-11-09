import { z } from "zod";
export const savedAttendee = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(1).max(100),
    email: z.union([z.literal(""), z.email().max(254)]),
    phone: z.union([z.literal(""), z.string().regex(/^\+[1-9][0-9]{6,14}$/)]),
  })
  .strict();
export const savedAttendeesInput = z
  .object({
    expectedVersion: z.number().int().min(0).max(2147483646),
    consentVersion: z.literal(1),
    consent: z.boolean(),
    items: z.array(savedAttendee).max(10),
  })
  .strict();
export const savedAttendeesResponse = z
  .object({
    version: z.number().int().nonnegative(),
    consentVersion: z.literal(1),
    consent: z.boolean(),
    items: z.array(savedAttendee).max(10),
  })
  .strict();

export const attendeeConsentHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            purpose: z.literal("saved_attendees"),
            policyVersion: z.literal(1),
            policyText: z.string().min(1).max(3000).nullable(),
            granted: z.boolean(),
            preferenceVersion: z.number().int().positive(),
            recordedAt: z.iso.datetime(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.number().int().positive().nullable(),
  })
  .strict();
