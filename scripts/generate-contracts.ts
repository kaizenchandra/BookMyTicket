import { onlineSettings } from "../src/modules/events/adapters/online-schema.ts";
import {
  paymentRecoverySchema,
  paymentInitiationSchema,
} from "../src/modules/payments/adapters/schemas.ts";
import { eventInput } from "../src/modules/events/adapters/catalog-schema.ts";
import { communicationInput } from "../src/modules/profiles/adapters/communication-schema.ts";
import { movieInput } from "../src/modules/cinema/adapters/schema.ts";
import { fixtureInput } from "../src/modules/sports/adapters/schema.ts";
import {
  catalogFilters,
  suggestionFilters,
  catalogSearchResponse,
} from "../src/modules/catalog/adapters/schemas.ts";
import { freeCancelInput } from "../src/modules/bookings/adapters/free-cancellation-schema.ts";
import {
  freeConfirmationInput,
  freeConfirmationResponse,
} from "../src/modules/bookings/adapters/free-schema.ts";
import {
  invitationInput,
  invitationVersion,
  memberInput,
} from "../src/modules/providers/adapters/staff-schema.ts";
import {
  caseCommand,
  staffReply,
} from "../src/modules/support/adapters/schemas.ts";
import { pendingCancelInput } from "../src/modules/bookings/adapters/cancellation-schema.ts";
import { walletResponse } from "../src/modules/bookings/adapters/wallet-schema.ts";
import { exportInput } from "../src/modules/reporting/adapters/schemas.ts";
import { publishForm } from "../src/modules/events/adapters/schemas.ts";
import {
  venueInput,
  spaceInput,
  planInput,
  scheduleInput,
  scheduleSeriesInput,
} from "../src/modules/venues/adapters/schemas.ts";
import {
  listingInput,
  listingUpdate,
} from "../src/modules/catalog/adapters/schemas.ts";
import {
  paymentCheckoutSchema,
  paymentStatusSchema,
} from "../src/modules/payments/adapters/schemas.ts";
import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  quoteInputSchema,
  quoteResponseSchema,
  placementInputSchema,
  policyInputSchema,
  assignmentInputSchema,
} from "../src/modules/pricing/adapters/schemas.ts";
const source = await readFile("src/app.ts", "utf8"),
  paths: Record<string, any> = {};
const requests: Record<string, unknown> = {
  "post /api/v1/occurrences/series": z.toJSONSchema(scheduleSeriesInput),
  "post /api/v1/occurrences/series/preview":
    z.toJSONSchema(scheduleSeriesInput),
  "post /api/v1/bookings/{id}/payment/reconcile": z.toJSONSchema(
    paymentInitiationSchema,
  ),
  "post /api/v1/organizations/{id}/events": z.toJSONSchema(eventInput),
  "put /api/v1/organizations/{id}/events/{listingId}": z.toJSONSchema(
    eventInput.extend({ version: z.number().int().positive() }),
  ),
  "put /api/v1/profile/communications": z.toJSONSchema(communicationInput),
  "post /api/v1/organizations/{id}/cinema": z.toJSONSchema(movieInput),
  "put /api/v1/organizations/{id}/cinema/{listingId}": z.toJSONSchema(
    movieInput.extend({ version: z.number().int().positive() }),
  ),
  "post /api/v1/organizations/{id}/sports": z.toJSONSchema(fixtureInput),
  "put /api/v1/organizations/{id}/sports/{listingId}": z.toJSONSchema(
    fixtureInput.extend({ version: z.number().int().positive() }),
  ),
  "post /api/v1/bookings/{id}/free-cancellation":
    z.toJSONSchema(freeCancelInput),
  "post /api/v1/bookings/{id}/free-cancellation/preview": z.toJSONSchema(
    z.object({}).strict(),
  ),
  "post /api/v1/bookings/{id}/free-confirmation": z.toJSONSchema(
    freeConfirmationInput,
  ),
  "post /api/v1/operations/notification-deliveries/{id}/replay": z.toJSONSchema(
    z.object({ reason: z.string().trim().min(5).max(2000) }).strict(),
  ),
  "post /api/v1/notifications/{id}/read": z.toJSONSchema(z.object({}).strict()),
  "post /api/v1/organizations/{id}/invitations":
    z.toJSONSchema(invitationInput),
  "post /api/v1/organizations/{id}/invitations/{invitationId}/revoke":
    z.toJSONSchema(invitationVersion),
  "put /api/v1/organizations/{id}/staff/{accountId}":
    z.toJSONSchema(memberInput),
  "post /api/v1/provider-invitations/{id}/accept": z.toJSONSchema(
    z.object({}).strict(),
  ),
  "post /api/v1/operations/cases/{id}/actions": z.toJSONSchema(caseCommand),
  "post /api/v1/operations/cases/{id}/messages": z.toJSONSchema(staffReply),
  "post /api/v1/bookings/{id}/pending-cancellation":
    z.toJSONSchema(pendingCancelInput),
  "post /api/v1/bookings/{id}/pending-cancellation/preview": z.toJSONSchema(
    z.object({}).strict(),
  ),
  "post /api/v1/attendee-exports": z.toJSONSchema(exportInput),
  "put /api/v1/occurrences/{id}/online-access": z.toJSONSchema(onlineSettings),
  "post /api/v1/bookings/{id}/online-access/{occurrenceId}": z.toJSONSchema(
    z.object({}).strict(),
  ),
  "put /api/v1/occurrences/{id}/registration-form": z.toJSONSchema(publishForm),
  "post /api/v1/organizations/{id}/venues": z.toJSONSchema(venueInput),
  "post /api/v1/organizations/{id}/venues/{venueId}/spaces":
    z.toJSONSchema(spaceInput),
  "post /api/v1/organizations/{id}/spaces/{spaceId}/plans":
    z.toJSONSchema(planInput),
  "post /api/v1/occurrences": z.toJSONSchema(scheduleInput),
  "post /api/v1/organizations/{id}/listings": z.toJSONSchema(listingInput),
  "put /api/v1/listings/{id}": z.toJSONSchema(listingUpdate),
  "post /api/v1/bookings/{id}/payment": z.toJSONSchema(z.object({}).strict()),
  "post /api/v1/bookings/{id}/payment/callback": z.toJSONSchema(
    z
      .object({
        paymentId: z.string().regex(/^pay_[A-Za-z0-9]+$/),
        signature: z.string().regex(/^[a-f0-9]{64}$/i),
      })
      .strict(),
  ),
  "post /api/v1/auth/sessions/revoke-others": z.toJSONSchema(
    z.object({}).strict(),
  ),
  "put /api/v1/favorites/{id}": z.toJSONSchema(z.object({}).strict()),
  "post /api/v1/quotes": z.toJSONSchema(quoteInputSchema),
  "post /api/v1/orders": z.toJSONSchema(placementInputSchema),
  "post /api/v1/admin/pricing/policies": z.toJSONSchema(policyInputSchema),
  "put /api/v1/admin/pricing/occurrences/{id}": z.toJSONSchema(
    assignmentInputSchema,
  ),
  "post /api/v1/auth/mfa/confirm": z.toJSONSchema(
    z
      .object({
        enrollmentId: z.string().uuid(),
        code: z.string().regex(/^\d{6}$/),
      })
      .strict(),
  ),
  "post /api/v1/auth/mfa/verify": z.toJSONSchema(
    z.object({ code: z.string().regex(/^\d{6}$/) }).strict(),
  ),
  "post /api/v1/auth/mfa/recover": z.toJSONSchema(
    z.object({ code: z.string().regex(/^[a-f0-9]{32}$/) }).strict(),
  ),
};
for (const [, method, raw] of source.matchAll(
  /(?:app|webhook)\.(get|post|put|delete)\(\s*["']([^"']+)["']/g,
)) {
  if (!raw.startsWith("/api/v1/")) continue;
  const path = raw.replace(/:([a-zA-Z]+)/g, "{$1}"),
    operation: any = {
      operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`,
      summary: `${method.toUpperCase()} ${path}`,
      responses: {
        "200": { description: "Successful operation" },
        "401": { description: "Authentication required" },
        "403": { description: "MFA or permission required" },
        "404": { description: "Not found in authorized scope" },
        "409": {
          description: "State, version, quote, or idempotency conflict",
        },
        "422": { description: "Input validation failed" },
        "429": { description: "Retry after rate-limit window" },
        "503": {
          description: "Required dependency or configuration unavailable",
        },
      },
    };
  const parameters = [...path.matchAll(/\{([^}]+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
  }));
  if (
    [
      "/api/v1/orders",
      "/api/v1/occurrences",
      "/api/v1/occurrences/series",
    ].includes(path)
  )
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: true,
      schema: { type: "string", minLength: 8, maxLength: 100 },
    } as any);
  if (parameters.length) operation.parameters = parameters;
  if (requests[`${method} ${path}`])
    operation.requestBody = {
      required: true,
      content: {
        "application/json": { schema: requests[`${method} ${path}`] },
      },
    };
  if (path === "/api/v1/bookings/{id}/free-confirmation")
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(freeConfirmationResponse) },
    };
  if (path === "/api/v1/catalog" || path === "/api/v1/catalog/suggestions") {
    const schema = z.toJSONSchema(
      path.endsWith("suggestions") ? suggestionFilters : catalogFilters,
      { io: "input" },
    );
    operation.parameters = Object.entries(schema.properties ?? {}).map(
      ([name, property]) => ({
        name,
        in: "query",
        required: schema.required?.includes(name) ?? false,
        schema: property,
      }),
    );
    if (path === "/api/v1/catalog")
      operation.responses["200"].content = {
        "application/json": { schema: z.toJSONSchema(catalogSearchResponse) },
      };
  }
  if (path === "/api/v1/bookings/{id}/payment/reconcile")
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(paymentRecoverySchema) },
    };
  if (path === "/api/v1/quotes")
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(quoteResponseSchema) },
    };
  if (
    path === "/api/v1/bookings/{id}/payment" ||
    path === "/api/v1/bookings/{id}/payment/callback"
  )
    operation.responses["200"].content = {
      "application/json": {
        schema: z.toJSONSchema(
          method === "post" && path.endsWith("/payment")
            ? paymentCheckoutSchema
            : paymentStatusSchema,
        ),
      },
    };
  if (path === "/api/v1/bookings/{id}/tickets")
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(walletResponse) },
    };
  if (
    path === "/api/v1/bookings/{id}/tickets/download" ||
    path === "/api/v1/bookings/{id}/calendar"
  )
    operation.responses["200"].content = {
      [path.endsWith("/calendar") ? "text/calendar" : "text/html"]: {
        schema: { type: "string" },
      },
    };
  if (
    ![
      "/api/v1/catalog",
      "/api/v1/cities",
      "/api/v1/config",
      "/api/v1/auth/challenges",
      "/api/v1/auth/verify",
      "/api/v1/payments/webhook",
    ].some((p) => path === p || path.startsWith("/api/v1/catalog/"))
  )
    operation.security = [{ session: [] }];
  (paths[path] ??= {})[method] = operation;
}
await writeFile(
  "docs/contracts/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "BookMyTicket API contracts",
        version: JSON.parse(await readFile("package.json", "utf8")).version,
        description:
          "Exact request schemas for pricing, MFA, payment initiation/callback, session revocation and favorites; quote and payment-status response contracts verified by HTTP integration test. Remaining endpoint response schemas are draft and require completion.",
      },
      paths,
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "session" },
        },
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(`Generated ${Object.keys(paths).length} API paths.`);
