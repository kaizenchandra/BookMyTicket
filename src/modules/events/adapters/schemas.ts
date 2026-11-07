import { z } from "zod";
export const formDefinition = z
  .object({
    title: z.string().trim().min(2).max(150),
    instructions: z.string().max(2000),
    fields: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
            label: z.string().trim().min(1).max(150),
            purpose: z.string().trim().min(5).max(500),
            type: z.enum([
              "text",
              "email",
              "phone",
              "date",
              "choice",
              "checkbox",
            ]),
            required: z.boolean(),
            maxLength: z.number().int().min(1).max(500),
            options: z.array(z.string().trim().min(1).max(500)).max(30),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export const publishForm = z
  .object({
    expectedVersion: z.number().int().min(0),
    definition: formDefinition,
  })
  .strict();
