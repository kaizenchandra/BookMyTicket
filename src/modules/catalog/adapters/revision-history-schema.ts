import { categoryRevisionFields } from "../domain/revision-snapshot.ts";
import { z } from "zod";
const revisionId = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine(
    (v) => v.length < 19 || (v.length === 19 && v <= "9223372036854775807"),
    "Revision reference exceeds supported range",
  );
export const listingRevisionFilters = z
  .object({ beforeId: revisionId.optional() })
  .strict();
export const listingRevisionPage = z
  .object({
    items: z
      .array(
        z
          .object({
            id: revisionId,
            version: z.number().int().positive(),
            reason: z.string().nullable(),
            createdAt: z.iso.datetime(),
            actorId: z.uuid().nullable().optional(),
            snapshot: z
              .object({
                title: z.string().nullable(),
                description: z.string().nullable(),
                city: z.string().nullable(),
                kind: z.string().nullable(),
                state: z.string().nullable(),
                categoryDetails: z.partialRecord(
                  z.enum(categoryRevisionFields),
                  z.string().nullable(),
                ),
              })
              .strict(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: revisionId.nullable(),
  })
  .strict();

export const listingRevisionComparisonInput = z
  .object({ fromId: revisionId, toId: revisionId })
  .strict()
  .refine((v) => v.fromId !== v.toId, "Choose two different revisions");
export const listingRevisionComparison = z
  .object({
    from: z
      .object({ id: revisionId, version: z.number().int().positive() })
      .strict(),
    to: z
      .object({ id: revisionId, version: z.number().int().positive() })
      .strict(),
    changes: z
      .array(
        z
          .object({
            field: z.enum([
              "title",
              "description",
              "city",
              "kind",
              "state",
              ...categoryRevisionFields.map(
                (field) => `categoryDetails.${field}`,
              ),
            ]),
            before: z.string().nullable(),
            after: z.string().nullable(),
          })
          .strict(),
      )
      .max(5 + categoryRevisionFields.length),
  })
  .strict();
