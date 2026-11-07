import { z } from "zod";
export const invitationInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    role: z.enum(["editor", "viewer"]),
  })
  .strict();
export const invitationVersion = z
  .object({ version: z.number().int().positive() })
  .strict();
export const memberInput = invitationVersion
  .extend({ role: z.enum(["editor", "viewer", "revoke"]) })
  .strict();
