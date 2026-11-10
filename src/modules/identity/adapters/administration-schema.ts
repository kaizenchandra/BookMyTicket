import { z } from "zod";
import { adminPermissions } from "../application/administration.ts";
export const accountFiltersInput = z
  .object({
    sort: z.enum(["newest", "oldest"]).optional(),
    id: z.uuid().optional(),
    q: z.string().trim().max(100).optional(),
    role: z.uuid().optional(),
    permission: z.enum(adminPermissions).optional(),
    contact: z.string().trim().min(3).max(254).optional(),
    status: z.enum(["active", "suspended"]).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict();
export const accountChange = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    roles: z
      .array(z.uuid())
      .max(20)
      .refine((x) => new Set(x).size === x.length, "Duplicate role")
      .optional(),
    expectedVersion: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1000),
    status: z.enum(["active", "suspended"]).optional(),
    permissions: z
      .array(z.enum(adminPermissions))
      .max(adminPermissions.length)
      .optional(),
  })
  .strict()
  .refine(
    (x) =>
      x.status !== undefined ||
      x.permissions !== undefined ||
      x.roles !== undefined ||
      x.name !== undefined,
    {
      message: "Choose a status or permission change",
    },
  )
  .refine(
    (x) =>
      !x.permissions || new Set(x.permissions).size === x.permissions.length,
    { message: "Permissions must be unique" },
  );

export const accountFilters = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ""));
}, accountFiltersInput);
export const adminAccount = z.object({
  id: z.uuid(),
  contact: z.string(),
  status: z.enum(["active", "suspended"]),
  name: z.string(),
  directPermissions: z.array(z.string()).optional(),
  roles: z.array(z.uuid()).optional(),
  created_at: z.string(),
  version: z.number().int().positive(),
  permissions: z.array(z.string()).optional(),
});
export const adminAccountPage = z.object({
  items: z.array(adminAccount).max(25),
  nextCursor: z.string().nullable(),
});
export const adminAccountChanged = z.object({
  id: z.uuid(),
  status: z.enum(["active", "suspended"]),
  name: z.string(),
  directPermissions: z.array(z.string()),
  roles: z.array(z.uuid()),
  version: z.number().int().positive(),
  permissions: z.array(z.string()),
});
export const adminAccountDetail = adminAccount.extend({
  directPermissions: z.array(z.string()),
  roles: z.array(z.uuid()),
  permissions: z.array(z.string()),
  roleDefinitions: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      description: z.string(),
      active: z.boolean(),
      version: z.number().int().positive(),
      permissions: z.array(z.string()),
    }),
  ),
});
