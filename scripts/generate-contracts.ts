import {paymentAdminFilters,paymentReportInput,paymentDetailQuery,paymentAdminPage,paymentAdminDetail,paymentExceptionPage,paymentReportResponse} from "../src/modules/payments/adapters/administration-schema.ts";
import {exceptionInput,exceptionHistory,exceptionResponse,exceptionDetailResponse} from "../src/modules/bookings/adapters/exceptions-schema.ts";
import {cabKind,cabCreate,cabEdit,cabFilters,cabDisruption,cabHistoryQuery,cabRecordResponse,cabPageResponse,cabDetailResponse,cabHistoryResponse,cabPreview,cabPriceResponse} from "../src/modules/cabs/adapters/schema.ts";
import {packageCreate,packageEdit,packageAction,packageFilters,packagePreview,packageAllotment,packageHistoryQuery,packagePageResponse,packageDetailResponse,packagePublishedResponse,packagePriceResponse,packageHistoryResponse} from "../src/modules/packages/adapters/schema.ts";
import {trainKind,trainCreate,trainEdit,trainFilters,trainIncident,trainHistoryQuery,trainRecordResponse,trainPageResponse,trainDetailResponse,trainHistoryResponse} from "../src/modules/trains/adapters/schema.ts";
import {busKind,busCreate,busEdit,busFilters,busDisruption,busHistoryQuery,busRecordResponse,busPageResponse,busDetailResponse,busHistoryResponse} from "../src/modules/buses/adapters/schema.ts";
import {hotelRoomInput,hotelRoomEdit,hotelPlanInput,hotelPlanEdit,hotelCalendarQuery,hotelBulkInput,hotelHoldInput,hotelAllocationAction,hotelHistoryQuery,hotelReconciliationInput,hotelRoomsResponse,hotelCalendarResponse,hotelAllocationResponse,hotelAllocationsResponse,hotelChangesResponse} from "../src/modules/inventory/adapters/hotel-schema.ts";
import {propertyCreate,propertyEdit,propertyAction,propertyFilters,propertyResponse,propertyPage,publishedPropertyPage,propertyHistory} from "../src/modules/hotels/adapters/schema.ts";
import {supplierInput,supplierUpdate,supplierFilters,commercialInput,previewInput,supplierResponse,ruleResponse,supplierPage,supplierDetail,previewResponse} from "../src/modules/flights/adapters/schema.ts";
import {customerFilterInput,customerStatusChange,customerHistoryFilters,customerPage,customerDetail,customerHistoryPage} from "../src/modules/identity/adapters/customer-admin-schema.ts";
import {roleInput,roleUpdate,roleFilters,adminCreation,rolePage,roleResponse,adminActivityPage} from "../src/modules/identity/adapters/roles-schema.ts";
import {accountFiltersInput,accountChange,adminAccountPage,adminAccountChanged,adminAccountDetail} from "../src/modules/identity/adapters/administration-schema.ts";
import {adminBookingFiltersInput,adminBookingPage,adminPaymentFilters} from "../src/modules/bookings/adapters/admin-schema.ts";
import {financeRecordFilters} from "../src/modules/payments/adapters/admin.ts";
import { dashboardFilters, dashboardPage, dashboardRecordKind, dashboardRecordsPage } from "../src/modules/reporting/adapters/dashboard-schema.ts";
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
  "post /api/v1/admin/users":z.toJSONSchema(adminCreation,{io:'input'}),
  "post /api/v1/admin/roles":z.toJSONSchema(roleInput,{io:'input'}),
  "patch /api/v1/admin/roles/{id}":z.toJSONSchema(roleUpdate,{io:'input'}),
  "patch /api/v1/admin/users/{id}": z.toJSONSchema(accountChange),
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
  /(?:app|webhook)\.(get|post|put|patch|delete)\(\s*["']([^"']+)["']/g,
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
  if(['/api/v1/admin/users','/api/v1/admin/customers','/api/v1/admin/bookings','/api/v1/admin/payments','/api/v1/admin/refunds','/api/v1/admin/bookings/{id}/payments'].includes(path)){
    const schema=z.toJSONSchema(path.endsWith('/{id}/payments')?adminPaymentFilters:path==='/api/v1/admin/bookings'?adminBookingFiltersInput:path.endsWith('/users')||path.endsWith('/customers')?accountFiltersInput:financeRecordFilters,{io:'input'});
    operation.parameters=[...parameters,...Object.entries(schema.properties??{}).map(([name,property])=>({name,in:'query',required:false,schema:property}))];
    operation.description='Current MFA and route-specific platform permission required. Reads are audited. Cursor scope binds filters and actor. Contacts and provider identifiers are redacted.';
  }
  if(method==='get'&&(path==='/api/v1/admin/users'||path==='/api/v1/admin/customers'))operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(adminAccountPage)}};
  if(path==='/api/v1/holiday-packages'||path.startsWith('/api/v1/admin/packages')){
    const list=path==='/api/v1/admin/packages',history=path.endsWith('/history'),preview=path.endsWith('/preview'),allotments=path.endsWith('/allotments'),actions=path.endsWith('/actions');
    operation.description='Holiday package information/pricing/allotment planning only; bookable=false. Requires packages.read and fresh MFA for admin routes; definition/allotment/submit writes packages.manage; review actions packages.review. Published edits return to draft. Public projection excludes supplier references, costs and commercial markup. Versioned plans are not supplier-confirmed availability. Component reservation, compensation and fulfillment integrations are not configured.';
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(path==='/api/v1/holiday-packages'?packagePublishedResponse:list?packagePageResponse:history?packageHistoryResponse:packageDetailResponse)}};
      if(list||history||path==='/api/v1/holiday-packages'){const q=z.toJSONSchema(history?packageHistoryQuery:packageFilters,{io:'input'});operation.parameters=[...parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(list?packageCreate:preview?packagePreview:allotments?packageAllotment:actions?packageAction:packageEdit,{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:list?{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}:preview?z.toJSONSchema(packagePriceResponse):{type:'object',properties:{updated:{const:true},bookable:{const:false}},required:['updated']}}};
      if(list)operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
    }
  }
  if(path.startsWith('/api/v1/admin/trains/')){
    const list=path.endsWith('/{kind}'),history=path.endsWith('/history'),incident=path.endsWith('/incidents');
    operation.description='Local railway reference catalogue only. Requires trains.read and current MFA; writes additionally trains.manage. kind is stations, routes or services; content must match path kind. Immutable station codes and snapshots; unique class codes; ordered stop timing; final arrival matches route offset. Versioned writes and immutable history/audit. Provider integration is not configured: availability/fare/PNR/booking/waitlist/cancellation/refund status are null and bookable=false. Local incidents do not submit provider requests.';
    operation.parameters=parameters.map(p=>p.name==='kind'?{...p,schema:z.toJSONSchema(trainKind)}:p);
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(list?trainPageResponse:history?trainHistoryResponse:trainDetailResponse)}};
      if(list||history){const q=z.toJSONSchema(history?trainHistoryQuery:trainFilters,{io:'input'});operation.parameters=[...operation.parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(incident?trainIncident:method==='post'?z.union([trainCreate.stations,trainCreate.routes,trainCreate.services]):z.union([trainEdit.stations,trainEdit.routes,trainEdit.services]),{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:list?{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}:z.toJSONSchema(trainRecordResponse)}};
      if(list)operation.parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}});
    }
  }
  if(path==='/api/v1/admin/bookings/{id}/tickets/download'){
    operation.description='Audited admission ticket HTML document containing current valid QR credentials. Requires bookings.read/manage and fresh MFA, confirmed booking, existing wallet issuance/validity rules. Private no-store attachment; not a supplier voucher or invoice.';
    operation.responses['200'].content={'text/html':{schema:{type:'string'}}};
  }
  if(path==='/api/v1/admin/bookings/{id}/exceptions'){
    operation.description='Booking exception case state only; never changes booking/payment/ticket state. Read requires bookings.read and fresh MFA; actions also bookings.manage. Active authorized assignees, versioned transitions, actor-key fingerprint replay, immutable history/audit and durable event commit atomically.';
    if(method==='get'){const q=z.toJSONSchema(exceptionHistory,{io:'input'});operation.parameters=[...parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(exceptionDetailResponse)}};}
    else{operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(exceptionInput,{io:'input'})}}};operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(exceptionResponse)}};}
  }
  if(path.startsWith('/api/v1/admin/bookings/')&&path.includes('/pending-cancellation')){
    operation.description='Requires bookings.read/manage and fresh MFA. Only pending-payment orders can be cancelled. Preview checks payment activity; submission atomically revalidates preview/state, releases inventory, records cancellation/audit/outbox with staff attribution. Late captures require refund recovery; no refund success is implied. Actor-scoped retry fingerprint.';
    operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(path.endsWith('/preview')?z.object({}).strict():pendingCancelInput,{io:'input'})}}};
    if(!path.endsWith('/preview'))operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
  }
  if(path==='/api/v1/admin/payments'||path==='/api/v1/admin/payments/{id}'||path==='/api/v1/admin/payments/reports'||path==='/api/v1/admin/payment-exceptions'){
    operation.description='Finance permission and fresh MFA required; all reads/exports audited. Exact paise strings. Provider observations, local captures, recovery obligations and settlement availability remain separate. Refund execution and bank settlement integration are not implemented. Reports explicitly approved by requesting finance actor, bounded to 5000 rows and 366 days; CSV formula prefixes neutralized.';
    const report=path.endsWith('/reports'),list=path==='/api/v1/admin/payments',exceptions=path.endsWith('/payment-exceptions');
    if(report)operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(paymentReportInput,{io:'input'})}}};
    else {const q=z.toJSONSchema(list?paymentAdminFilters:paymentDetailQuery,{io:'input'});operation.parameters=[...parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(report?paymentReportResponse:list?paymentAdminPage:exceptions?paymentExceptionPage:paymentAdminDetail)}};
  }
  if(path.startsWith('/api/v1/admin/cabs/')){
    const list=path.endsWith('/{kind}'),history=path.endsWith('/history'),incident=path.endsWith('/disruptions'),preview=path.endsWith('/preview');
    operation.description='Cab catalogue and configured tariff estimates. Fresh MFA and cabs.read required; writes additionally cabs.manage (preview is read). Suppliers/categories/services use kind-specific content. Versioned writes and actor-scoped create replay, atomic immutable history/audit. Directional endpoint and full trip-window checks, current active supplier/category and party/distance constraints. Exact paise distance ceiling plus waiting/per-trip fees. Estimates exclude taxes/tolls/parking and do not confirm availability. No supplier booking, cancellation, rescheduling, actual charge or reconciliation adapter is configured.';
    operation.parameters=parameters.map(p=>p.name==='kind'?{...p,schema:z.toJSONSchema(cabKind)}:p);
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(list?cabPageResponse:history?cabHistoryResponse:cabDetailResponse)}};
      if(list||history){const q=z.toJSONSchema(history?cabHistoryQuery:cabFilters,{io:'input'});operation.parameters=[...operation.parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(preview?cabPreview:incident?cabDisruption:method==='post'?z.union([cabCreate.suppliers,cabCreate.categories,cabCreate.services]):z.union([cabEdit.suppliers,cabEdit.categories,cabEdit.services]),{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:preview?z.toJSONSchema(cabPriceResponse):list?{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}:z.toJSONSchema(cabRecordResponse)}};
      if(list)operation.parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}});
    }
  }
  if(path.startsWith('/api/v1/admin/buses/')){
    const list=path.endsWith('/{kind}'),history=path.endsWith('/history'),incident=path.endsWith('/disruptions');
    operation.description='Local bus reference catalogue only. Requires buses.read and current MFA; writes additionally buses.manage. kind is operators, routes or services; request content must match the path kind. Stable codes, actor/operation/key create replay, expectedVersion writes, immutable history and atomic audit. Service layout/fares/cancellation rules are indicative. Availability, booked seats, booking and ticket status are null until an authorized supplier is connected. Disruption actions do not cancel supplier bookings or issue refunds/notifications.';
    operation.parameters=parameters.map(p=>p.name==='kind'?{...p,schema:z.toJSONSchema(busKind)}:p);
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(list?busPageResponse:history?busHistoryResponse:busDetailResponse)}};
      if(list||history){const q=z.toJSONSchema(history?busHistoryQuery:busFilters,{io:'input'});operation.parameters=[...operation.parameters,...Object.entries(q.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(incident?busDisruption:method==='post'?z.union([busCreate.operators,busCreate.routes,busCreate.services]):z.union([busEdit.operators,busEdit.routes,busEdit.services]),{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:list?{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}:z.toJSONSchema(busRecordResponse)}};
      if(list)operation.parameters.push({name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}});
    }
  }
  if(path==='/api/v1/hotels'||path.startsWith('/api/v1/admin/hotels')){
    operation.description='Property content only, not room inventory or booking. Admin reads require hotels.read and fresh MFA; create/edit/submit additionally hotels.manage; review/suspend/delist/reopen additionally hotels.review. Atomic versioned mutations, immutable snapshots and audit. Published edits return to draft. Public reads only published content, excluding private contacts and supplier association. Supplier synchronization is not configured.';
    if(method==='get'){
      const history=path.endsWith('/history'),detail=path.endsWith('/{id}');
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(path==='/api/v1/hotels'?publishedPropertyPage:history?propertyHistory:detail?propertyResponse:propertyPage)}};
      if(history)operation.parameters=[...parameters,{name:'before',in:'query',required:false,schema:{type:'integer',minimum:1}}];
      else if(!detail){const query=z.toJSONSchema(propertyFilters,{io:'input'});operation.parameters=[...parameters,...Object.entries(query.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      const action=path.endsWith('/actions');operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(action?propertyAction:method==='patch'?propertyEdit:propertyCreate,{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:action||method==='patch'?z.toJSONSchema(propertyResponse):{type:'object',required:['id'],properties:{id:{type:'string',format:'uuid'}}}}};
      if(!action&&method==='post')operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
    }
  }
  if(path.startsWith('/api/v1/admin/hotel-rooms/')||path==='/api/v1/admin/hotels/{id}/rooms'){
    operation.description='Hotel inventory allocation only; does not create booking/payment. Active hotels.read and fresh MFA required. Room/hold/actions/reconciliation require hotels.manage; plans require pricing; bulk calendar requires both. Ten-minute database-time holds share room capacity across all plans. Multi-night all-or-nothing allocation; expired holds excluded without cleanup; retries never extend expiry. Date endpoints are exclusive and use IST nights. Manual reconciliation records observations without changing inventory. No channel manager is configured.';
    const rooms=path.endsWith('/rooms'),plans=path.endsWith('/plans'),planEdit=path.endsWith('/plans/{planId}'),calendar=path.endsWith('/calendar'),holds=path.endsWith('/holds'),actions=path.endsWith('/actions'),reconcile=path.endsWith('/reconciliation'),history=path.endsWith('/history'),allocations=path.endsWith('/allocations');
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(rooms?hotelRoomsResponse:calendar?hotelCalendarResponse:allocations?hotelAllocationsResponse:hotelChangesResponse)}};
      operation.parameters=parameters;
      if(!rooms){const query=z.toJSONSchema(calendar?hotelCalendarQuery:hotelHistoryQuery,{io:'input'});operation.parameters=[...parameters,...Object.entries(query.properties??{}).map(([name,schema])=>({name,in:'query',required:calendar,schema}))];}
    }else{
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(rooms?hotelRoomInput:plans?hotelPlanInput:planEdit?hotelPlanEdit:calendar?hotelBulkInput:holds?hotelHoldInput:actions?hotelAllocationAction:reconcile?hotelReconciliationInput:hotelRoomEdit,{io:'input'})}}};
      const result=holds||actions?z.toJSONSchema(hotelAllocationResponse):rooms||plans||planEdit?{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}:reconcile?{type:'object',properties:{discrepancies:{type:'array',items:{type:'object'}},inventoryChanged:{const:false}},required:['discrepancies','inventoryChanged']}:{type:'object',properties:{updated:{const:true},nights:{type:'integer'}},required:['updated']};
      operation.responses['200'].content={'application/json':{schema:result}};
      if(rooms||plans||holds||reconcile)operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
    }
  }
  if(path.startsWith('/api/v1/admin/flights/suppliers')){
    operation.description='Supplier profile and commercial configuration only; no live flight adapter is configured. Requires flights.read and current MFA. Profile writes additionally require flights.manage; commercial writes/previews require pricing. Changes audited with expectedVersion; create requests require actor-scoped Idempotency-Key. No credentials accepted. Profiles cannot be activated for sale. Preview is arithmetic only, not a fare quote.';
    if(method==='get'){
      operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(path.endsWith('/{id}')?supplierDetail:supplierPage)}};
      if(!path.endsWith('/{id}')){const query=z.toJSONSchema(supplierFilters);operation.parameters=[...parameters,...Object.entries(query.properties??{}).map(([name,schema])=>({name,in:'query',required:false,schema}))];}
    }else{
      const preview=path.endsWith('/price-preview'),rule=path.endsWith('/commercial-rule');
      operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(preview?previewInput:rule?commercialInput:method==='patch'?supplierUpdate:supplierInput,{io:'input'})}}};
      operation.responses['200'].content={'application/json':{schema:preview?z.toJSONSchema(previewResponse):rule?z.toJSONSchema(ruleResponse):method==='patch'?z.toJSONSchema(supplierResponse):{type:'object',required:['id'],properties:{id:{type:'string',format:'uuid'}}}}};
      if(method==='post'&&!preview)operation.parameters=[...parameters,{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
    }
  }
  if(path.startsWith('/api/v1/admin/customers')){
    operation.description='Requires customers.read and current MFA. Audited reads; masked contacts and attendees. Histories additionally require bookings.read, finance or support. Status/flags changes require access.manage, reason and expectedVersion, and revoke sessions. Wallet and loyalty are unsupported. Dates are inclusive from/exclusive until; activity uses booking creation dates and counts ever-confirmed bookings.';
    if(path==='/api/v1/admin/customers'||path.endsWith('/history')){const query=z.toJSONSchema(path.endsWith('/history')?customerHistoryFilters:customerFilterInput,{io:'input'});operation.parameters=[...parameters,...Object.entries(query.properties??{}).map(([name,schema])=>({name,in:'query',required:name==='kind',schema}))];}
    if(method==='get')operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(path.endsWith('/history')?customerHistoryPage:path.endsWith('/{id}')?customerDetail:customerPage)}};
    if(method==='patch'){operation.requestBody={required:true,content:{'application/json':{schema:z.toJSONSchema(customerStatusChange)}}};operation.responses['200'].content={'application/json':{schema:{type:'object',properties:{updated:{const:true}},required:['updated']}}};}
  }
  if(path==='/api/v1/admin/bookings')operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(adminBookingPage)}};
  if(path==='/api/v1/admin/bookings/{id}/payments')operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(paymentHistoryPage)}};
  if(path==='/api/v1/admin/users/{id}'){
    operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(method==='get'?adminAccountDetail:adminAccountChanged)}};
    operation.description=method==='get'?'Requires access.manage and current MFA. Masked administrator account, direct/effective permissions and active/inactive assigned role definitions. Read is audited.':'Requires access.manage and current MFA. Reason and expectedVersion required; case-insensitive self changes forbidden. Revokes all target sessions atomically with change and audit. Scoped grants are preserved.';
  }
  if(path==='/api/v1/admin/roles'){
    operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(method==='get'?rolePage:roleResponse)}};
    if(method==='get'){const schema=z.toJSONSchema(roleFilters);operation.parameters=Object.entries(schema.properties??{}).map(([name,property])=>({name,in:'query',required:false,schema:property}));}
  }
  if(path==='/api/v1/admin/roles/{id}')operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(roleResponse)}};
  if(path==='/api/v1/admin/users/{id}/activity')operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(adminActivityPage)}};
  if(method==='post'&&(path==='/api/v1/admin/users'||path==='/api/v1/admin/roles')){
    operation.parameters=[{name:'Idempotency-Key',in:'header',required:true,schema:{type:'string',minLength:8,maxLength:100}}];
    operation.description='Requires active access.manage and fresh MFA. Actor/operation scoped idempotency rejects changed payloads. No invitation or initial session is issued; new administrators must verify their email and MFA. Role definitions grant no access until assigned.';
    if(path==='/api/v1/admin/users')operation.responses['200'].content={'application/json':{schema:{type:'object',properties:{id:{type:'string',format:'uuid'}},required:['id']}}};
  }
  if(path==='/api/v1/admin/dashboard/records'){
    const schema=z.toJSONSchema(dashboardFilters,{io:'input'});
    operation.parameters=[...Object.entries(schema.properties??{}).map(([name,property])=>({name,in:'query',required:schema.required?.includes(name)??false,schema:property})),{name:'kind',in:'query',required:true,schema:z.toJSONSchema(dashboardRecordKind)},{name:'after',in:'query',required:false,schema:{type:'string',maxLength:1500}}];
    operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(dashboardRecordsPage)}};
    operation.description='Finance and current MFA required. Booking/customer/support records additionally require bookings.read/customers.read/support. Actor/filter/date-bound keyset pages. These are current records, not historical snapshot drilldowns.';
  }
  if(path==='/api/v1/admin/dashboard/history/{id}'){
    operation.responses['200'].content={'application/json':{schema:z.toJSONSchema(dashboardPage)}};
    operation.description='Immutable captured financial report. Current finance permission and MFA required; support aggregate redacted unless current support permission exists.';
  }
  if(path==='/api/v1/admin/dashboard/history'){
    operation.responses['200'].content={'application/json':{schema:{type:'object',properties:{items:{type:'array',maxItems:20,items:{type:'object',properties:{id:{type:'string',format:'uuid'},created_at:{type:'string',format:'date-time'},definition_version:{type:'string'},filters:z.toJSONSchema(dashboardFilters,{io:'input'})},required:['id','created_at','definition_version','filters']}}},required:['items']}}};
  }
  if (path === "/api/v1/admin/dashboard") {
    operation.responses["200"].content = {"application/json":{schema:z.toJSONSchema(dashboardPage)}};
    const schema=z.toJSONSchema(dashboardFilters,{io:'input'});
    operation.parameters=Object.entries(schema.properties??{}).map(([name,property])=>({name,in:'query',required:schema.required?.includes(name)??false,schema:property}));
    operation.description='Finance permission and current MFA required; support aggregates require support permission. IST calendar/preset/custom periods and current catalog product/city/partner plus booking-state filters. INR only. Includes demo records. Decimal paise strings. Zero-filled daily/monthly series. Returns an immutable historical capture ID; definitions version 2. Booking cohorts, cash events and inventory use distinct bases.';
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
