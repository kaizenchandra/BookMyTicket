import { z } from "zod";
import { adminPermissions } from "../application/administration.ts";
const permissionList = z
  .array(z.enum(adminPermissions))
  .max(adminPermissions.length)
  .refine((x) => new Set(x).size === x.length, "Duplicate permission");
const roleList = z
  .array(z.uuid())
  .max(20)
  .refine((x) => new Set(x).size === x.length, "Duplicate role");
export const roleInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(500).default(""),
    permissions: permissionList,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict();
export const roleUpdate = roleInput.extend({
  expectedVersion: z.number().int().positive(),
  active: z.boolean(),
});
export const adminCreation = z
  .object({
    contact: z
      .email()
      .max(254)
      .transform((x) => x.trim().toLowerCase()),
    name: z.string().trim().min(2).max(100),
    roles: roleList,
    permissions: permissionList,
    reason: z.string().trim().min(10).max(1000),
  })
  .strict()
  .refine(
    (x) => x.roles.length + x.permissions.length > 0,
    "Assign at least one role or permission",
  );
export const adminRequestKey = z.string().min(8).max(100);
export const roleFilters = z
  .object({
    sort: z.enum(["newest", "oldest"]).optional(),
    q: z.string().trim().max(80).optional(),
    active: z.enum(["true", "false"]).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict();
export const roleResponse = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  version: z.number().int().positive(),
  permissions: z.array(z.enum(adminPermissions)),
  members: z.string().optional(),
  created_at: z.string().optional(),
});
export const rolePage = z.object({
  items: z.array(roleResponse).max(25),
  nextCursor: z.string().nullable(),
});
export const adminActivityPage = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        actor_id: z.uuid().nullable(),
        action: z.string(),
        target: z.string(),
        created_at: z.string(),
        change: z.record(z.string(), z.unknown()),
      }),
    )
    .max(25),
  nextCursor: z.string().nullable(),
});
