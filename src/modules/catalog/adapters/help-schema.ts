import { z } from "zod";
import { helpTopics, helpDestinations } from "../domain/help.ts";
export const helpId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(100);
export const helpFilters = z
  .object({
    q: z
      .string()
      .max(100)
      .transform((value) => value.trim())
      .optional(),
    topic: z.enum(helpTopics).optional(),
    after: helpId.optional(),
  })
  .strict();
export const helpResponse = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string(),
            version: z.number().int().positive(),
            topic: z.enum(helpTopics),
            question: z.string(),
            answer: z.string(),
            href: z.string().startsWith("/"),
            action: z.string(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: helpId.nullable(),
  })
  .strict();
export type HelpPage = z.infer<typeof helpResponse>;

export const helpEdit = z
  .object({
    question: z.string().trim().min(1).max(200),
    answer: z.string().trim().min(1).max(4000),
    topic: z.enum(helpTopics),
    published: z.boolean(),
    version: z.number().int().min(1).max(2147483646),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
export const helpEditorPage = z
  .object({
    items: z
      .array(
        helpResponse.shape.items.element
          .extend({ published: z.boolean() })
          .strict(),
      )
      .max(20),
    nextCursor: helpId.nullable(),
  })
  .strict();
export const helpSaved = z
  .object({
    id: helpId,
    version: z.number().int().positive(),
    replayed: z.boolean(),
  })
  .strict();
export type HelpEditorPage = z.infer<typeof helpEditorPage>;

export const helpHistoryFilters = z
  .object({
    beforeVersion: z
      .string()
      .regex(/^[1-9][0-9]{0,9}$/)
      .refine(
        (value) => Number(value) <= 2147483647,
        "Version is out of range.",
      )
      .optional(),
  })
  .strict();
export const helpHistoryPage = z
  .object({
    items: z
      .array(
        z
          .object({
            inputVersion: z.number().int().positive(),
            version: z.number().int().positive(),
            actorId: z.uuid(),
            reason: z.string(),
            createdAt: z.iso.datetime(),
            before: z
              .object({
                question: z.string(),
                answer: z.string(),
                topic: z.enum(helpTopics),
                published: z.boolean(),
              })
              .strict(),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z.number().int().positive().nullable(),
  })
  .strict();
export type HelpHistoryPage = z.infer<typeof helpHistoryPage>;

export const helpCreation = helpEdit
  .omit({ version: true, published: true })
  .extend({
    id: helpId,
    destination: z.enum(
      Object.keys(helpDestinations) as [
        keyof typeof helpDestinations,
        ...(keyof typeof helpDestinations)[],
      ],
    ),
  })
  .strict();

export const helpAdminFilters = z
  .object({
    after: helpId.optional(),
    q: z
      .string()
      .max(100)
      .transform((value) => value.trim())
      .optional(),
    status: z.enum(["all", "published", "unpublished"]).optional(),
  })
  .strict();
