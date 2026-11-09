import { z } from "zod";
export const invitationInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(["editor", "viewer"]),
  })
  .strict();
export const invitationVersion = z
  .object({ version: z.number().int().positive().max(2147483646) })
  .strict();
export const membershipVersion = z
  .union([
    z
      .string()
      .regex(/^[1-9][0-9]{0,18}$/)
      .refine(
        (value) =>
          /^[1-9][0-9]{0,18}$/.test(value) &&
          BigInt(value) <= 9223372036854775807n,
        "Version exceeds PostgreSQL bigint range.",
      ),
    z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  ])
  .describe(
    "Positive PostgreSQL bigint decimal string, maximum 9223372036854775807. Legacy safe integer numbers are also accepted.",
  );
export const memberInput = z
  .object({
    version: membershipVersion,
    role: z.enum(["editor", "viewer", "revoke"]),
  })
  .strict();

export const staffInvitationFilters = z
  .object({
    afterCreatedAt: z.iso.datetime({ precision: 6 }).optional(),
    afterId: z.uuid().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.afterCreatedAt) === Boolean(v.afterId), {
    message: "Both pagination boundary fields are required together.",
  });
export const staffPageFilters = z
  .object({
    ...staffInvitationFilters.shape,
    afterMemberId: z.uuid().optional(),
    memberRole: z.enum(["owner", "editor", "viewer"]).optional(),
    invitationState: z
      .enum(["pending", "expired", "accepted", "revoked"])
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.afterCreatedAt) === Boolean(v.afterId), {
    message: "Both invitation boundary fields are required together.",
  });
export const staffPageResponse = z
  .object({
    members: z
      .array(
        z
          .object({
            account_id: z.uuid(),
            role: z.enum(["owner", "editor", "viewer"]),
            version: z.string().regex(/^[1-9][0-9]*$/),
          })
          .strict(),
      )
      .max(20),
    nextMemberCursor: z.object({ afterMemberId: z.uuid() }).strict().nullable(),
    invitations: z
      .array(
        z
          .object({
            id: z.uuid(),
            email: z.string(),
            role: z.enum(["editor", "viewer"]),
            state: z.enum(["pending", "accepted", "revoked", "expired"]),
            version: z.number().int().positive(),
            expires_at: z.iso.datetime(),
            createdAt: z.iso.datetime({ precision: 6 }),
          })
          .strict(),
      )
      .max(20),
    nextCursor: z
      .object({
        afterCreatedAt: z.iso.datetime({ precision: 6 }),
        afterId: z.uuid(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const recipientInvitationPage = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.uuid(),
            organization_id: z.uuid(),
            organization_name: z.string(),
            role: z.enum(["editor", "viewer"]),
            expires_at: z.iso.datetime(),
            createdAt: z.iso.datetime({ precision: 6 }),
          })
          .strict(),
      )
      .max(20),
    nextCursor: staffPageResponse.shape.nextCursor,
  })
  .strict();
