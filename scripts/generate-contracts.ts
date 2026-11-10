import { paymentHistoryFilters, paymentHistoryPage } from "../src/modules/bookings/adapters/payment-history-schema.ts";
import { bookingTimelinePage } from "../src/modules/bookings/adapters/timeline-schema.ts";
import { helpFilters, helpResponse, helpEdit, helpEditorPage, helpSaved, helpHistoryFilters, helpHistoryPage, helpCreation, helpAdminFilters } from "../src/modules/catalog/adapters/help-schema.ts";
import { favoriteFilters, favoritePage, favoriteState } from "../src/modules/profiles/adapters/favorites-schema.ts";
import {
  organizationCreationInput,
  organizationCreationKey,
} from "../src/modules/providers/adapters/creation-schema.ts";
import {
  listingRevisionFilters,
  listingRevisionComparisonInput,
  listingRevisionComparison,
  listingRevisionPage,
} from "../src/modules/catalog/adapters/revision-history-schema.ts";
import {
  listingReviewHistoryFilters,
  listingReviewHistoryPage,
} from "../src/modules/catalog/adapters/review-history-schema.ts";
import {
  listingQueueFilters,
  listingReviewInput,
  listingQueuePage,
} from "../src/modules/catalog/adapters/review-queue-schema.ts";
import {
  reviewQueueFilters,
  reviewQueuePage,
} from "../src/modules/providers/adapters/review-queue-schema.ts";
import {
  reviewHistoryFilters,
  reviewHistoryPage,
  providerReviewInput,
} from "../src/modules/providers/adapters/review-history-schema.ts";
import {
  onboardingInput,
  onboardingResponse,
} from "../src/modules/providers/adapters/onboarding-schema.ts";
import {
  organizationDraftInput,
  organizationSubmitInput,
} from "../src/modules/providers/adapters/draft-schema.ts";
import {
  savedAttendeesInput,
  savedAttendeesResponse,
  attendeeConsentHistoryPage,
} from "../src/modules/profiles/adapters/saved-attendees-schema.ts";
import {
  profileInput,
  profileResponse,
} from "../src/modules/profiles/adapters/profile-schema.ts";
import {
  venueFavoriteFilters,
  venueFavoritePage,
} from "../src/modules/profiles/adapters/venue-favorites-schema.ts";
import {
  publicVenueFilters,
  publicVenuePage,
} from "../src/modules/venues/adapters/public-schema.ts";
import {
  notificationFilters,
  notificationReadMany,
  notificationReadManyResponse,
  notificationUnreadManyResponse,
  notificationReadResponse,
  notificationPage,
} from "../src/modules/notifications/adapters/schemas.ts";
import { staffCaseDetailPage } from "../src/modules/support/adapters/schemas.ts";
import {
  messageFilters,
  customerMessagePage,
} from "../src/modules/support/adapters/schemas.ts";
import {
  customerCasePage,
  caseListFilters,
} from "../src/modules/support/adapters/schemas.ts";
import {
  supportDirectoryFilters,
  supportDirectoryPage,
} from "../src/modules/identity/adapters/support-directory-schema.ts";
import { createCaseInput } from "../src/modules/support/adapters/schemas.ts";
import { escalationInput } from "../src/modules/support/adapters/schemas.ts";
import { assignmentInput as supportAssignmentInput } from "../src/modules/support/adapters/schemas.ts";
import {
  historyFilters,
  historyPage,
} from "../src/modules/bookings/adapters/history-schema.ts";
import {
  auditFilters,
  auditPage,
} from "../src/modules/reporting/adapters/audit-schema.ts";
import { onlineSettings } from "../src/modules/events/adapters/online-schema.ts";
import {
  paymentRecoverySchema,
  paymentInitiationSchema,
} from "../src/modules/payments/adapters/schemas.ts";
import { eventInput } from "../src/modules/events/adapters/catalog-schema.ts";
import {
  communicationInput,
  consentHistoryFilters,
  consentHistoryPage,
} from "../src/modules/profiles/adapters/communication-schema.ts";
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
  staffInvitationFilters,
  staffPageResponse,
  staffPageFilters,
  recipientInvitationPage,
  invitationInput,
  invitationVersion,
  memberInput,
} from "../src/modules/providers/adapters/staff-schema.ts";
import {
  caseFilters,
  casePage,
  caseCommand,
  staffReply,
} from "../src/modules/support/adapters/schemas.ts";
import { pendingCancelInput } from "../src/modules/bookings/adapters/cancellation-schema.ts";
import { walletResponse } from "../src/modules/bookings/adapters/wallet-schema.ts";
import { exportInput } from "../src/modules/reporting/adapters/schemas.ts";
import { publishForm } from "../src/modules/events/adapters/schemas.ts";
import {
  venueInput,
  venueGuidanceInput,
  venueContactInput,
  venueMediaInput,
  spaceInput,
  planInput,
  scheduleInput,
  scheduleSeriesInput,
} from "../src/modules/venues/adapters/schemas.ts";
import {
  listingInput,
  listingUpdate,
  listingSubmitInput,
  listingCreationKey,
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
  "put /api/v1/profile/attendees": z.toJSONSchema(savedAttendeesInput),
  "put /api/v1/organizations/{id}/draft": z.toJSONSchema(
    organizationDraftInput,
  ),
  "post /api/v1/organizations/{id}/submit": z.toJSONSchema(
    organizationSubmitInput,
  ),
  "put /api/v1/organizations/{id}/onboarding": z.toJSONSchema(onboardingInput),
  "post /api/v1/admin/providers/{id}/review":
    z.toJSONSchema(providerReviewInput),
  "post /api/v1/admin/listings/{id}/review": z.toJSONSchema(listingReviewInput),
  "put /api/v1/profile": z.toJSONSchema(profileInput),
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
  "post /api/v1/notifications/read": z.toJSONSchema(notificationReadMany),
  "post /api/v1/notifications/unread": z.toJSONSchema(notificationReadMany),
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
  "post /api/v1/cases": z.toJSONSchema(createCaseInput),
  "post /api/v1/cases/{id}/escalation": z.toJSONSchema(escalationInput),
  "post /api/v1/operations/cases/{id}/assignment": z.toJSONSchema(
    supportAssignmentInput,
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
  "post /api/v1/organizations/{id}/venues/{venueId}/guidance":
    z.toJSONSchema(venueGuidanceInput),
  "post /api/v1/organizations/{id}/venues/{venueId}/contact":
    z.toJSONSchema(venueContactInput),
  "post /api/v1/organizations/{id}/venues/{venueId}/media":
    z.toJSONSchema(venueMediaInput),
  "post /api/v1/organizations/{id}/venues": z.toJSONSchema(venueInput),
  "post /api/v1/organizations/{id}/venues/{venueId}/spaces":
    z.toJSONSchema(spaceInput),
  "post /api/v1/organizations/{id}/spaces/{spaceId}/plans":
    z.toJSONSchema(planInput),
  "post /api/v1/occurrences": z.toJSONSchema(scheduleInput),
  "post /api/v1/organizations": z.toJSONSchema(organizationCreationInput),
  "post /api/v1/organizations/{id}/listings": z.toJSONSchema(listingInput),
  "put /api/v1/listings/{id}": z.toJSONSchema(listingUpdate),
  "post /api/v1/listings/{id}/submit": z.toJSONSchema(listingSubmitInput),
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
  "put /api/v1/venue-favorites/{id}": z.toJSONSchema(z.object({}).strict()),
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
      "/api/v1/operations/cases/{id}/assignment",
      "/api/v1/cases/{id}/escalation",
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
  if (
    [
      "/api/v1/cases",
      "/api/v1/cases/{id}/messages",
      "/api/v1/operations/cases/{id}/messages",
      "/api/v1/operations/cases/{id}/actions",
    ].includes(path) &&
    method === "post"
  )
    parameters.push({
      name: "Idempotency-Key",
      in: "header",
      required: false,
      schema: { type: "string", minLength: 8, maxLength: 100 },
      description:
        "Use a stable key for retry-safe case creation, replies or workflow actions. Legacy callers without it do not receive deduplication.",
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
  if (path === "/api/v1/bookings") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(historyPage) },
    };
    const schema = z.toJSONSchema(historyFilters);
    operation.parameters = Object.entries(schema.properties ?? {}).map(
      ([name, property]) => ({
        name,
        in: "query",
        required: false,
        schema: property,
      }),
    );
  }
  if (path === "/api/v1/venue-favorites/{id}") {
    operation.responses["200"].content = {
      "application/json": {
        schema: z.toJSONSchema(z.object({ saved: z.boolean() }).strict()),
      },
    };
  }
  if (
    path === "/api/v1/profile/attendees" &&
    (method === "get" || method === "put")
  )
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(savedAttendeesResponse) },
    };
  if (
    [
      "/api/v1/organizations/{id}/onboarding",
      "/api/v1/admin/providers/{id}/onboarding",
    ].includes(path)
  )
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(onboardingResponse) },
    };
  if (
    [
      "/api/v1/organizations/{id}/reviews",
      "/api/v1/admin/providers/{id}/reviews",
    ].includes(path)
  ) {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(reviewHistoryPage) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(
        z.toJSONSchema(reviewHistoryFilters).properties ?? {},
      ).map(([name, schema]) => ({
        name,
        in: "query",
        required: false,
        schema,
      })),
    ];
  }
  if (
    [
      "/api/v1/listings/{id}/reviews",
      "/api/v1/admin/listings/{id}/reviews",
    ].includes(path)
  ) {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(listingReviewHistoryPage) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(
        z.toJSONSchema(listingReviewHistoryFilters).properties ?? {},
      ).map(([name, schema]) => ({
        name,
        in: "query",
        required: false,
        schema,
      })),
    ];
  }
  if (
    [
      "/api/v1/listings/{id}/revisions",
      "/api/v1/admin/listings/{id}/revisions",
    ].includes(path)
  ) {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(listingRevisionPage) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(
        z.toJSONSchema(listingRevisionFilters).properties ?? {},
      ).map(([name, schema]) => ({
        name,
        in: "query",
        required: false,
        schema,
      })),
    ];
  }
  if (
    [
      "/api/v1/listings/{id}/revisions/compare",
      "/api/v1/admin/listings/{id}/revisions/compare",
    ].includes(path)
  ) {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(listingRevisionComparison) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(
        z.toJSONSchema(listingRevisionComparisonInput).properties ?? {},
      ).map(([name, schema]) => ({
        name,
        in: "query",
        required: true,
        schema,
      })),
    ];
  }
  if (path === "/api/v1/organizations/{id}/listings" && method === "post") {
    operation.parameters = [
      ...(operation.parameters ?? []),
      {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: z.toJSONSchema(listingCreationKey),
      },
    ];
  }
  if (path === "/api/v1/organizations" && method === "post")
    operation.parameters = [
      {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: z.toJSONSchema(organizationCreationKey),
      },
    ];
  if (path === "/api/v1/admin/listings" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(listingQueuePage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(listingQueueFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/provider-invitations" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(recipientInvitationPage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(staffInvitationFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/organizations/{id}/staff" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(staffPageResponse) },
    };
    operation.parameters = [
      ...parameters,
      ...Object.entries(z.toJSONSchema(staffPageFilters).properties ?? {}).map(
        ([name, schema]) => ({
          name,
          in: "query",
          required: false,
          schema,
        }),
      ),
    ];
  }
  if (path === "/api/v1/admin/providers" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(reviewQueuePage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(reviewQueueFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (
    path === "/api/v1/profile/attendees/consent-history" &&
    method === "get"
  ) {
    operation.responses["200"].content = {
      "application/json": {
        schema: z.toJSONSchema(attendeeConsentHistoryPage),
      },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(consentHistoryFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/profile/communications/history" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(consentHistoryPage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(consentHistoryFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/profile" && (method === "get" || method === "put"))
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(profileResponse) },
    };
  if (path === "/api/v1/admin/help/{id}/history" && method === "get") {
    operation.responses["200"].content = {"application/json": {schema: z.toJSONSchema(helpHistoryPage)}};
    operation.parameters = [...(operation.parameters ?? []), ...Object.entries(z.toJSONSchema(helpHistoryFilters).properties ?? {}).map(([name,schema])=>({name,in:"query",required:false,schema}))];
  }
  if (path === "/api/v1/bookings/{id}/payment-history" && method === "get") {
    operation.responses["200"].content = {"application/json":{schema:z.toJSONSchema(paymentHistoryPage)}};
    operation.parameters=[...(operation.parameters??[]),...Object.entries(z.toJSONSchema(paymentHistoryFilters,{io:"input"}).properties??{}).map(([name,schema])=>({name,in:"query",required:false,schema}))];
  }
  if (path === "/api/v1/bookings/{id}/timeline" && method === "get") {
    operation.responses["200"].content = {"application/json":{schema:z.toJSONSchema(bookingTimelinePage)}};
  }
  if (path === "/api/v1/admin/help" && method === "post") {
    operation.requestBody = {required:true, content:{"application/json":{schema:z.toJSONSchema(helpCreation)}}};
    operation.responses["200"].content = {"application/json":{schema:z.toJSONSchema(helpSaved)}};
  }
  if (path === "/api/v1/admin/help" && method === "get") {
    operation.responses["200"].content = {"application/json": {schema: z.toJSONSchema(helpEditorPage)}};
    operation.parameters = Object.entries(z.toJSONSchema(helpAdminFilters, {io:"input"}).properties ?? {}).map(([name,schema])=>({name,in:"query",required:false,schema}));
  }
  if (path === "/api/v1/admin/help/{id}" && method === "put") {
    operation.requestBody = {required: true, content: {"application/json": {schema: z.toJSONSchema(helpEdit)}}};
    operation.responses["200"].content = {"application/json": {schema: z.toJSONSchema(helpSaved)}};
  }
  if (path === "/api/v1/help" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(helpResponse) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(helpFilters, { io: "input" }).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/favorites" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(favoritePage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(favoriteFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/favorites/{id}" && ["get", "put", "delete"].includes(method)) {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(favoriteState) },
    };
  }
  if (path === "/api/v1/venue-favorites" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(venueFavoritePage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(venueFavoriteFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/venues/{id}" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(publicVenuePage) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(
        z.toJSONSchema(publicVenueFilters).properties ?? {},
      ).map(([name, schema]) => ({
        name,
        in: "query",
        required: false,
        schema,
      })),
    ];
  }
  if (path === "/api/v1/notifications/unread" && method === "post")
    operation.responses["200"].content = {
      "application/json": {
        schema: z.toJSONSchema(notificationUnreadManyResponse),
      },
    };
  if (path === "/api/v1/notifications/read" && method === "post")
    operation.responses["200"].content = {
      "application/json": {
        schema: z.toJSONSchema(notificationReadManyResponse),
      },
    };
  if (path === "/api/v1/notifications/{id}/read")
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(notificationReadResponse) },
    };
  if (path === "/api/v1/notifications" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(notificationPage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(notificationFilters).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/operations/cases/{id}" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(staffCaseDetailPage) },
    };
    operation.responses["200"].description =
      "Current case detail with newest 50 messages, chronological within page, and nullable nextMessageCursor. Use after to retrieve older messages; every page requires support permission and fresh MFA.";
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(z.toJSONSchema(messageFilters).properties ?? {}).map(
        ([name, schema]) => ({ name, in: "query", required: false, schema }),
      ),
    ];
  }
  if (path === "/api/v1/cases/{id}/messages" && method === "get") {
    operation.responses["200"].description =
      "Newest 50 customer-visible messages, oldest-to-newest within each page. Follow nextCursor using after for older messages.";
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(customerMessagePage) },
    };
    operation.parameters = [
      ...(operation.parameters ?? []),
      ...Object.entries(z.toJSONSchema(messageFilters).properties ?? {}).map(
        ([name, schema]) => ({ name, in: "query", required: false, schema }),
      ),
    ];
  }
  if (path === "/api/v1/cases" && method === "get") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(customerCasePage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(caseListFilters,{io:"input"}).properties ?? {},
    ).map(([name, schema]) => ({ name, in: "query", required: false, schema }));
  }
  if (path === "/api/v1/operations/support-agents") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(supportDirectoryPage) },
    };
    operation.parameters = Object.entries(
      z.toJSONSchema(supportDirectoryFilters).properties ?? {},
    ).map(([name, schema]) => ({
      name,
      in: "query",
      required: name === "q",
      schema,
    }));
  }
  if (path === "/api/v1/operations/cases") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(casePage) },
    };
    const schema = z.toJSONSchema(caseFilters);
    operation.parameters = Object.entries(schema.properties ?? {}).map(
      ([name, property]) => ({
        name,
        in: "query",
        required: false,
        schema: property,
      }),
    );
  }
  if (path === "/api/v1/admin/audit") {
    operation.responses["200"].content = {
      "application/json": { schema: z.toJSONSchema(auditPage) },
    };
    const schema = z.toJSONSchema(auditFilters);
    operation.parameters = Object.entries(schema.properties ?? {}).map(
      ([name, property]) => ({
        name,
        in: "query",
        required: false,
        schema: property,
      }),
    );
  }
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
