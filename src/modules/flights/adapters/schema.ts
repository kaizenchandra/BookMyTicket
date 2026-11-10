import { z } from "zod";
const reason = z.string().trim().min(10).max(1000);
export const supplierInput = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{1,39}$/),
    name: z.string().trim().min(2).max(100),
    airlineCodes: z
      .array(z.string().regex(/^[A-Z0-9]{2}$/))
      .max(100)
      .refine((x) => new Set(x).size === x.length, "Duplicate airline code"),
    environment: z.enum(["sandbox", "production"]),
    reason,
  })
  .strict();
export const supplierUpdate = supplierInput.extend({
  expectedVersion: z.number().int().positive(),
  status: z.enum(["draft", "suspended"]),
});
export const supplierFilters = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(["draft", "suspended"]).optional(),
    after: z.string().max(1500).optional(),
  })
  .strict();
export const commercialInput = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    markupBps: z.number().int().min(0).max(10000),
    serviceFeePaise: z
      .string()
      .regex(/^(0|[1-9]\d{0,8})$/)
      .refine((x) => BigInt(x) <= 100000000n),
    reason,
  })
  .strict();
export const previewInput = z
  .object({
    basePaise: z.string().regex(/^(0|[1-9]\d{0,17})$/),
    taxPaise: z.string().regex(/^(0|[1-9]\d{0,17})$/),
  })
  .strict();
export const flightRequestKey = z
  .string()
  .min(8)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);
export const supplierResponse=z.object({id:z.uuid(),code:z.string(),name:z.string(),airlineCodes:z.array(z.string()),environment:z.enum(['sandbox','production']),status:z.enum(['draft','suspended']),version:z.number().int().positive(),created_at:z.string()});
export const ruleResponse=z.object({version:z.number().int().positive(),markup_bps:z.number().int(),service_fee_paise:z.string()});
export const supplierPage=z.object({items:z.array(supplierResponse).max(25),nextCursor:z.string().nullable()});
export const supplierDetail=z.object({supplier:supplierResponse,rule:ruleResponse.nullable(),integration:z.object({state:z.literal('not_configured'),message:z.string()})});
export const previewResponse=z.object({currency:z.literal('INR'),basePaise:z.string(),taxPaise:z.string(),markupPaise:z.string(),serviceFeePaise:z.string(),totalPaise:z.string(),ruleVersion:z.number().int(),bookable:z.literal(false)});
