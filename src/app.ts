import { BookingPaymentHistory } from "./modules/bookings/application/payment-history.ts";
import { PostgresPaymentHistory } from "./modules/payments/adapters/history.ts";
import { paymentHistoryFilters } from "./modules/bookings/adapters/payment-history-schema.ts";
import { BookingTimeline } from "./modules/bookings/application/timeline.ts";
import { PostgresBookingTimeline } from "./modules/bookings/adapters/timeline.ts";
import { Help, HelpEditor } from "./modules/catalog/application/help.ts";
import { PostgresHelp } from "./modules/catalog/adapters/help-postgres.ts";
import { helpFilters, helpId, helpEdit, helpHistoryFilters, helpCreation, helpAdminFilters } from "./modules/catalog/adapters/help-schema.ts";
import { favoriteFilters } from "./modules/profiles/adapters/favorites-schema.ts";
import { PostgresActiveAccount } from "./modules/identity/adapters/active.ts";
import { OrganizationCreation } from "./modules/providers/application/creation.ts";
import { PostgresOrganizationCreation } from "./modules/providers/adapters/creation.ts";
import {
  organizationCreationInput,
  organizationCreationKey,
} from "./modules/providers/adapters/creation-schema.ts";
import { ListingRevisionHistory } from "./modules/catalog/application/revision-history.ts";
import { PostgresListingRevisionHistory } from "./modules/catalog/adapters/revision-history.ts";
import {
  listingRevisionFilters,
  listingRevisionComparisonInput,
} from "./modules/catalog/adapters/revision-history-schema.ts";
import { ListingReviewHistory } from "./modules/catalog/application/review-history.ts";
import { PostgresListingReviewHistory } from "./modules/catalog/adapters/review-history.ts";
import { listingReviewHistoryFilters } from "./modules/catalog/adapters/review-history-schema.ts";
import {
  listingQueueFilters,
  listingReviewInput,
} from "./modules/catalog/adapters/review-queue-schema.ts";
import { reviewQueueFilters } from "./modules/providers/adapters/review-queue-schema.ts";
import { ReviewHistory } from "./modules/providers/application/review-history.ts";
import { PostgresReviewHistory } from "./modules/providers/adapters/review-history.ts";
import {
  reviewHistoryFilters,
  providerReviewInput,
} from "./modules/providers/adapters/review-history-schema.ts";
import { Onboarding } from "./modules/providers/application/onboarding.ts";
import { PostgresOnboarding } from "./modules/providers/adapters/onboarding.ts";
import { onboardingInput } from "./modules/providers/adapters/onboarding-schema.ts";
import { OrganizationDrafts } from "./modules/providers/application/drafts.ts";
import {
  organizationDraftInput,
  organizationSubmitInput,
} from "./modules/providers/adapters/draft-schema.ts";
import { SavedAttendees } from "./modules/profiles/application/saved-attendees.ts";
import { PostgresSavedAttendees } from "./modules/profiles/adapters/saved-attendees.ts";
import { savedAttendeesInput } from "./modules/profiles/adapters/saved-attendees-schema.ts";
import { Profile } from "./modules/profiles/application/profile.ts";
import { profileInput } from "./modules/profiles/adapters/profile-schema.ts";
import { VenueFavorites } from "./modules/profiles/application/venue-favorites.ts";
import { PostgresVenueFavorites } from "./modules/profiles/adapters/venue-favorites.ts";
import { venueFavoriteFilters } from "./modules/profiles/adapters/venue-favorites-schema.ts";
import { PublicVenue } from "./modules/venues/application/public-venue.ts";
import { PostgresPublicVenue } from "./modules/venues/adapters/public-venue.ts";
import { PostgresVenueSessions } from "./modules/catalog/adapters/venue-sessions.ts";
import { publicVenueFilters } from "./modules/venues/adapters/public-schema.ts";
import {
  notificationFilters,
  notificationReadMany,
} from "./modules/notifications/adapters/schemas.ts";
import { messageFilters } from "./modules/support/adapters/schemas.ts";
import { PostgresEvents } from "./modules/reporting/adapters/outbox.ts";
import { caseListFilters } from "./modules/support/adapters/schemas.ts";
import { SupportDirectory } from "./modules/identity/application/support-directory.ts";
import { PostgresSupportDirectory } from "./modules/identity/adapters/support-directory.ts";
import { supportDirectoryFilters } from "./modules/identity/adapters/support-directory-schema.ts";
import { PostgresSupportBookingReader } from "./modules/bookings/adapters/support-reader.ts";
import { createCaseInput } from "./modules/support/adapters/schemas.ts";
import { CustomerEscalation } from "./modules/support/application/escalation.ts";
import { PostgresEscalation } from "./modules/support/adapters/escalation.ts";
import { escalationInput } from "./modules/support/adapters/schemas.ts";
import { SupportAssignment } from "./modules/support/application/assignment.ts";
import { PostgresAssignment } from "./modules/support/adapters/assignment.ts";
import { PostgresStaffAuthorization } from "./modules/identity/adapters/staff-authorization.ts";
import { assignmentInput as supportAssignmentInput } from "./modules/support/adapters/schemas.ts";
import { BookingHistory } from "./modules/bookings/application/history.ts";
import { PostgresHistory } from "./modules/bookings/adapters/history.ts";
import { historyFilters } from "./modules/bookings/adapters/history-schema.ts";
import { PostgresAudit } from "./modules/reporting/adapters/audit.ts";
import { AuditHistory } from "./modules/reporting/application/audit-search.ts";
import { PostgresAuditSearch } from "./modules/reporting/adapters/audit-search.ts";
import { auditFilters } from "./modules/reporting/adapters/audit-schema.ts";
import { onlineSettings } from "./modules/events/adapters/online-schema.ts";
import { isAllowedOrigin } from "./shared/request-origin.ts";
import { EventCatalog } from "./modules/events/application/catalog.ts";
import { PostgresEventCatalog } from "./modules/events/adapters/catalog.ts";
import { eventInput } from "./modules/events/adapters/catalog-schema.ts";
import { Communications } from "./modules/profiles/application/communications.ts";
import { PostgresCommunications } from "./modules/profiles/adapters/communications.ts";
import {
  communicationInput,
  consentHistoryFilters,
} from "./modules/profiles/adapters/communication-schema.ts";
import { Movies } from "./modules/cinema/application/movies.ts";
import { PostgresMovies } from "./modules/cinema/adapters/postgres.ts";
import { movieInput } from "./modules/cinema/adapters/schema.ts";
import { Fixtures } from "./modules/sports/application/fixtures.ts";
import { PostgresFixtures } from "./modules/sports/adapters/postgres.ts";
import { fixtureInput } from "./modules/sports/adapters/schema.ts";
import { PostgresCategoryDrafts } from "./modules/catalog/adapters/category-drafts.ts";
import {
  catalogFilters,
  suggestionFilters,
} from "./modules/catalog/adapters/schemas.ts";
import { freeCancelInput } from "./modules/bookings/adapters/free-cancellation-schema.ts";
import { freeConfirmationInput } from "./modules/bookings/adapters/free-schema.ts";
import { PostgresConsumer } from "./modules/reporting/adapters/consumer.ts";
import { notificationService } from "./composition.ts";
import { ProviderStaff } from "./modules/providers/application/staff.ts";
import { PostgresProviderStaff } from "./modules/providers/adapters/staff.ts";
import {
  staffInvitationFilters,
  staffPageFilters,
  invitationInput,
  invitationVersion,
  memberInput,
} from "./modules/providers/adapters/staff-schema.ts";
import { SupportOperations } from "./modules/support/application/operations.ts";
import { PostgresSupportOperations } from "./modules/support/adapters/operations.ts";
import {
  caseFilters,
  caseCommand,
  staffReply,
} from "./modules/support/adapters/schemas.ts";
import { pendingCancelInput } from "./modules/bookings/adapters/cancellation-schema.ts";
import { ticketDocument } from "./modules/bookings/adapters/ticket-document.ts";
import { exportInput } from "./modules/reporting/adapters/schemas.ts";
import { publishForm } from "./modules/events/adapters/schemas.ts";
import {
  listingInput,
  listingUpdate,
  listingSubmitInput,
  listingCreationKey,
} from "./modules/catalog/adapters/schemas.ts";
import { Venues } from "./modules/venues/application/venues.ts";
import { PostgresVenues } from "./modules/venues/adapters/postgres.ts";
import {
  venueInput,
  venueGuidanceInput,
  venueContactInput,
  venueMediaInput,
  spaceInput,
  planInput,
  scheduleInput,
  scheduleSeriesInput,
} from "./modules/venues/adapters/schemas.ts";
import { Scheduling } from "./modules/inventory/application/scheduling.ts";
import {
  paymentInitiationSchema,
  paymentCallbackSchema,
} from "./modules/payments/adapters/schemas.ts";
import { Favorites } from "./modules/profiles/application/favorites.ts";
import { PostgresFavorites } from "./modules/profiles/adapters/favorites.ts";
import { Sessions } from "./modules/identity/application/sessions.ts";
import { PostgresSessions } from "./modules/identity/adapters/sessions.ts";
import { assertSchemaReady, migrationManifest } from "./shared/schema-state.ts";
import { Mfa } from "./modules/identity/application/mfa.ts";
import { PostgresMfa } from "./modules/identity/adapters/mfa.ts";
import { Policies } from "./modules/pricing/application/policies.ts";
import { PostgresPolicies } from "./modules/pricing/adapters/policies.ts";
import { PostgresPolicyTarget } from "./modules/inventory/adapters/policy-target.ts";
import {
  quoteInputSchema,
  placementInputSchema,
  policyInputSchema,
  assignmentInputSchema,
} from "./modules/pricing/adapters/schemas.ts";
import { commerce } from "./composition.ts";
import { CatalogManagement } from "./modules/catalog/application/manage.ts";
import { PostgresCatalogManagement } from "./modules/catalog/adapters/manage.ts";
import { PostgresProviderReview } from "./modules/providers/adapters/review.ts";
import { PostgresSchedule } from "./modules/inventory/adapters/schedule.ts";
import { PostgresCases } from "./modules/support/adapters/postgres.ts";
import { FinanceViews } from "./modules/finance/adapters/views.ts";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import serveStatic from "@fastify/static";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z, ZodError } from "zod";
import { pool } from "./shared/database.ts";
import { AppError } from "./shared/errors.ts";
import { PostgresIdentity } from "./modules/identity/adapters/postgres.ts";
import {
  otpDelivery,
  localMailpitUrl,
} from "./modules/identity/adapters/delivery.ts";
import { Authentication } from "./modules/identity/application/authentication.ts";
import { PostgresProviders } from "./modules/providers/adapters/postgres.ts";
import { PostgresProfiles } from "./modules/profiles/adapters/postgres.ts";
import { Discovery } from "./modules/catalog/application/catalog.ts";
import { PostgresCatalog } from "./modules/catalog/adapters/postgres.ts";
import { Reservations } from "./modules/inventory/application/reservations.ts";
import { PostgresReservations } from "./modules/inventory/adapters/postgres.ts";
import { ingestWebhook } from "./modules/payments/adapters/webhooks.ts";
const uuid = z.string().uuid();
export async function buildApp() {
  const expectedMigrations = await migrationManifest();
  const app = Fastify({
    logger: {
      redact: ["req.headers.cookie", "req.headers.authorization", "req.body"],
    },
    bodyLimit: 65536,
    disableRequestLogging: true,
  });
  const identity = new PostgresIdentity(
    otpDelivery(),
    process.env.OTP_PEPPER ?? "",
  );
  const mfa = new Mfa(new PostgresMfa());
  const sessions = new Sessions(new PostgresSessions(new PostgresAudit()));
  const auth = new Authentication(identity),
    providers = new PostgresProviders(),
    profiles = new Profile(new PostgresProfiles());
  const catalog = new PostgresCatalog(),
    discovery = new Discovery(catalog),
    inventory = new PostgresReservations(catalog),
    reservations = new Reservations(inventory);
  const managedCatalog = new CatalogManagement(
      new PostgresCatalogManagement(
        providers,
        new PostgresStaffAuthorization(),
      ),
      providers,
    ),
    providerReview = new PostgresProviderReview(),
    venueStore = new PostgresVenues(providers, new PostgresAudit()),
    venues = new Venues(venueStore),
    schedule = new Scheduling(
      new PostgresSchedule(providers, catalog, new PostgresAudit()),
      providers,
      catalog,
      venueStore,
    ),
    cases = new PostgresCases(
      new PostgresAudit(),
      new PostgresSupportBookingReader(),
    ),
    finance = new FinanceViews();
  const {
    bookings,
    tickets,
    wallet,
    pendingCancellation,
    freeConfirmation,
    freeCancellation,
    quotes,
    placement,
    collection,
    forms,
    registrations,
    attendeeExports,
    registrationPreview,
    onlineAccess,
  } = commerce();
  const policies = new Policies(
    new PostgresPolicies(),
    new PostgresPolicyTarget(),
  );
  await app.register(cookie);
  app.addHook("onRequest", async (req, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.url.split("?")[0] !== "/api/v1/payments/webhook"
    ) {
      if (
        req.headers.origin &&
        !isAllowedOrigin(
          req.headers.origin,
          process.env.APP_ORIGIN ?? "http://localhost:3000",
          process.env.NODE_ENV,
        )
      )
        throw new AppError(
          "ORIGIN_DENIED",
          "Cross-origin mutation denied.",
          403,
        );
      if (req.headers["sec-fetch-site"] === "cross-site")
        throw new AppError("ORIGIN_DENIED", "Cross-site mutation denied.", 403);
    }
  });
  app.setErrorHandler((error, req, reply) => {
    if (error instanceof ZodError)
      return reply.code(422).send({
        code: "VALIDATION",
        message: "Check the submitted fields.",
        fields: error.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
        requestId: req.id,
      });
    if (error instanceof AppError)
      return reply
        .code(error.status)
        .send({ code: error.code, message: error.message, requestId: req.id });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500)
      return reply.code(status).send({
        code: "INVALID_REQUEST",
        message: "The request could not be processed.",
        requestId: req.id,
      });
    req.log.error(
      { requestId: req.id, code: (error as { code?: string }).code },
      "Request failed",
    );
    return reply.code(503).send({
      code: "SERVICE_UNAVAILABLE",
      message: "Service is temporarily unavailable. Please try again.",
      requestId: req.id,
    });
  });
  app.get("/health", async () => ({ status: "ok", version: "0.28.0" }));
  app.get("/ready", async () => {
    await assertSchemaReady(pool, expectedMigrations);
    return { status: "ready" };
  });
  app.get("/api/v1/config", async () => ({
    brand: "BookMyTicket",
    environment: process.env.NODE_ENV ?? "development",
    themes: ["LIGHT", "DARK"],
    otpAvailable:
      otpDelivery().available() && (process.env.OTP_PEPPER?.length ?? 0) >= 32,
    otpDelivery: process.env.OTP_DELIVERY ?? "resend",
    localMailpitUrl: localMailpitUrl(),
    paymentsAvailable: collection.available(),
    releaseStatus: "implementation_in_progress",
  }));
  const helpStore = new PostgresHelp(new PostgresStaffAuthorization(), new PostgresAudit());
  const help = new Help(helpStore), helpEditor = new HelpEditor(helpStore);
  app.post("/api/v1/admin/help", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return helpEditor.create(actor.id, helpCreation.parse(req.body));
  });
  app.get("/api/v1/admin/help", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return helpEditor.list(actor.id, helpAdminFilters.parse(req.query));
  });
  app.get("/api/v1/admin/help/:id/history", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    const filters = helpHistoryFilters.parse(req.query);
    return helpEditor.history(actor.id, helpId.parse((req.params as {id:string}).id), filters.beforeVersion === undefined ? undefined : Number(filters.beforeVersion));
  });
  app.put("/api/v1/admin/help/:id", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return helpEditor.save(actor.id, helpId.parse((req.params as {id:string}).id), helpEdit.parse(req.body));
  });
  app.get("/api/v1/help", async (req) => {
    const filters = helpFilters.parse(req.query);
    return help.search(filters.q, filters.topic, filters.after);
  });
  app.get("/api/v1/catalog", async (req) =>
    discovery.search(catalogFilters.parse(req.query)),
  );
  app.get("/api/v1/catalog/suggestions", async (req) => {
    const f = suggestionFilters.parse(req.query);
    return discovery.suggestions(f.q, f.city);
  });
  app.get("/api/v1/cities", async () => ({ items: await catalog.cities() }));
  app.get("/api/v1/catalog/:id", async (req) =>
    discovery.detail(uuid.parse((req.params as { id: string }).id)),
  );
  app.post("/api/v1/auth/challenges", async (req) =>
    auth.request(
      z
        .object({ email: z.email().max(254) })
        .strict()
        .parse(req.body).email,
    ),
  );
  app.post("/api/v1/auth/verify", async (req, reply) => {
    const input = z
      .object({ challengeId: uuid, code: z.string().regex(/^\d{6}$/) })
      .strict()
      .parse(req.body);
    const result = await auth.verify(input.challengeId, input.code);
    reply.setCookie("session", result.token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 43200,
    });
    return result.principal;
  });
  app.get("/api/v1/auth/mfa", async (req) => {
    await identity.authenticate(req.cookies.session);
    return mfa.status(req.cookies.session!);
  });
  app.post("/api/v1/auth/mfa/enroll", async (req) => {
    await identity.authenticate(req.cookies.session);
    return mfa.begin(req.cookies.session!);
  });
  app.post("/api/v1/auth/mfa/confirm", async (req) => {
    await identity.authenticate(req.cookies.session);
    const input = z
      .object({ enrollmentId: uuid, code: z.string().regex(/^\d{6}$/) })
      .strict()
      .parse(req.body);
    return mfa.confirm(req.cookies.session!, input.enrollmentId, input.code);
  });
  app.post("/api/v1/auth/mfa/verify", async (req) => {
    await identity.authenticate(req.cookies.session);
    return mfa.verify(
      req.cookies.session!,
      z
        .object({ code: z.string().regex(/^\d{6}$/) })
        .strict()
        .parse(req.body).code,
    );
  });
  app.post("/api/v1/auth/mfa/recover", async (req) => {
    await identity.authenticate(req.cookies.session);
    return mfa.recover(
      req.cookies.session!,
      z
        .object({ code: z.string().regex(/^[a-f0-9]{32}$/) })
        .strict()
        .parse(req.body).code,
    );
  });
  app.get("/api/v1/auth/sessions", async (req) => {
    await identity.authenticate(req.cookies.session);
    return sessions.list(req.cookies.session!);
  });
  app.delete("/api/v1/auth/sessions/:id", async (req) => {
    await identity.authenticate(req.cookies.session);
    return sessions.revoke(
      req.cookies.session!,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.post("/api/v1/auth/sessions/revoke-others", async (req) => {
    await identity.authenticate(req.cookies.session);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return sessions.revoke(req.cookies.session!, "others");
  });
  app.get("/api/v1/me", async (req) =>
    identity.authenticate(req.cookies.session),
  );
  app.post("/api/v1/auth/logout", async (req, reply) => {
    if (req.cookies.session) await identity.logout(req.cookies.session);
    reply.clearCookie("session", { path: "/" });
    return { signedOut: true };
  });
  const favorites = new Favorites(new PostgresFavorites(), catalog);
  app.get("/api/v1/favorites", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const query = favoriteFilters.parse(req.query);
    return favorites.list(actor.id, query.after);
  });
  app.get("/api/v1/favorites/:id", async (req) =>
    favorites.status(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.put("/api/v1/favorites/:id", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return favorites.save(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.delete("/api/v1/favorites/:id", async (req) =>
    favorites.remove(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  const communications = new Communications(new PostgresCommunications());
  app.get("/api/v1/profile/communications", async (req) =>
    communications.get((await identity.authenticate(req.cookies.session)).id),
  );
  app.get("/api/v1/profile/communications/history", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const filters = consentHistoryFilters.parse(req.query);
    return communications.history(
      actor.id,
      filters.beforeVersion ? Number(filters.beforeVersion) : undefined,
    );
  });
  app.put("/api/v1/profile/communications", async (req) =>
    communications.save(
      (await identity.authenticate(req.cookies.session)).id,
      communicationInput.parse(req.body),
    ),
  );
  const savedAttendees = new SavedAttendees(new PostgresSavedAttendees());
  app.get("/api/v1/profile/attendees/consent-history", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const filters = consentHistoryFilters.parse(req.query);
    return savedAttendees.history(
      actor.id,
      filters.beforeVersion ? Number(filters.beforeVersion) : undefined,
    );
  });
  app.get("/api/v1/profile/attendees", async (req) =>
    savedAttendees.get((await identity.authenticate(req.cookies.session)).id),
  );
  app.put("/api/v1/profile/attendees", async (req) =>
    savedAttendees.save(
      (await identity.authenticate(req.cookies.session)).id,
      savedAttendeesInput.parse(req.body),
    ),
  );
  app.get("/api/v1/profile", async (req) =>
    profiles.get((await identity.authenticate(req.cookies.session)).id),
  );
  app.put("/api/v1/profile", async (req) =>
    profiles.save(
      (await identity.authenticate(req.cookies.session)).id,
      profileInput.parse(req.body),
    ),
  );
  const providerStaff = new ProviderStaff(
    identity,
    new PostgresProviderStaff(new PostgresAudit()),
  );
  app.get("/api/v1/provider-invitations", async (req) =>
    providerStaff.inbox(
      req.cookies.session,
      staffInvitationFilters.parse(req.query),
    ),
  );
  app.post("/api/v1/provider-invitations/:id/accept", async (req) => {
    z.object({}).strict().parse(req.body);
    return providerStaff.accept(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.get("/api/v1/organizations/:id/staff", async (req) =>
    providerStaff.list(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      staffPageFilters.parse(req.query),
    ),
  );
  app.post("/api/v1/organizations/:id/invitations", async (req) =>
    providerStaff.invite(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      invitationInput.parse(req.body),
    ),
  );
  app.post(
    "/api/v1/organizations/:id/invitations/:invitationId/revoke",
    async (req) => {
      const p = req.params as { id: string; invitationId: string };
      return providerStaff.revoke(
        req.cookies.session,
        uuid.parse(p.id),
        uuid.parse(p.invitationId),
        invitationVersion.parse(req.body).version,
      );
    },
  );
  app.put("/api/v1/organizations/:id/staff/:accountId", async (req) => {
    const p = req.params as { id: string; accountId: string },
      b = memberInput.parse(req.body);
    return providerStaff.member(
      req.cookies.session,
      uuid.parse(p.id),
      uuid.parse(p.accountId),
      String(b.version),
      b.role,
    );
  });
  const categoryDrafts = new PostgresCategoryDrafts(providers),
    movies = new Movies(new PostgresMovies(categoryDrafts, catalog, providers)),
    fixtures = new Fixtures(
      new PostgresFixtures(categoryDrafts, catalog, providers),
    );
  const eventCatalog = new EventCatalog(
    new PostgresEventCatalog(categoryDrafts, catalog, providers),
  );
  app.get("/api/v1/organizations/:id/cinema", async (req) => ({
    items: await movies.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.post("/api/v1/organizations/:id/cinema", async (req) =>
    movies.save(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      movieInput.parse(req.body),
    ),
  );
  app.put("/api/v1/organizations/:id/cinema/:listingId", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      p = req.params as { id: string; listingId: string },
      { version, ...input } = movieInput
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
    return movies.save(
      actor.id,
      uuid.parse(p.id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      input,
      uuid.parse(p.listingId),
      version,
    );
  });
  app.get("/api/v1/catalog/:id/cinema", async (req) =>
    movies.detail(uuid.parse((req.params as { id: string }).id)),
  );
  app.get("/api/v1/organizations/:id/events", async (req) => ({
    items: await eventCatalog.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.post("/api/v1/organizations/:id/events", async (req) =>
    eventCatalog.save(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      eventInput.parse(req.body),
    ),
  );
  app.put("/api/v1/organizations/:id/events/:listingId", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      p = req.params as { id: string; listingId: string },
      { version, ...input } = eventInput
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
    return eventCatalog.save(
      actor.id,
      uuid.parse(p.id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      input,
      uuid.parse(p.listingId),
      version,
    );
  });
  app.get("/api/v1/catalog/:id/events", async (req) =>
    eventCatalog.detail(uuid.parse((req.params as { id: string }).id)),
  );
  app.get("/api/v1/organizations/:id/sports", async (req) => ({
    items: await fixtures.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.post("/api/v1/organizations/:id/sports", async (req) =>
    fixtures.save(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      fixtureInput.parse(req.body),
    ),
  );
  app.put("/api/v1/organizations/:id/sports/:listingId", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      p = req.params as { id: string; listingId: string },
      { version, ...input } = fixtureInput
        .extend({ version: z.number().int().positive() })
        .parse(req.body);
    return fixtures.save(
      actor.id,
      uuid.parse(p.id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      input,
      uuid.parse(p.listingId),
      version,
    );
  });
  app.get("/api/v1/catalog/:id/sports", async (req) =>
    fixtures.detail(uuid.parse((req.params as { id: string }).id)),
  );
  app.get("/api/v1/organizations", async (req) => ({
    items: await providers.list(
      (await identity.authenticate(req.cookies.session)).id,
    ),
  }));
  const organizationCreation = new OrganizationCreation(
    new PostgresOrganizationCreation(new PostgresActiveAccount()),
  );
  app.post("/api/v1/organizations", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return organizationCreation.create(
      actor.id,
      organizationCreationInput.parse(req.body),
      organizationCreationKey.parse(req.headers["idempotency-key"]),
    );
  });
  const onboarding = new Onboarding(
    new PostgresOnboarding(new PostgresAudit()),
  );
  app.get("/api/v1/organizations/:id/onboarding", async (req) =>
    onboarding.readOwner(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.put("/api/v1/organizations/:id/onboarding", async (req) =>
    onboarding.save(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      onboardingInput.parse(req.body),
    ),
  );
  app.get("/api/v1/admin/providers/:id/onboarding", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return onboarding.readReview(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  const organizationDrafts = new OrganizationDrafts(providers);
  app.put("/api/v1/organizations/:id/draft", async (req) =>
    organizationDrafts.edit(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      organizationDraftInput.parse(req.body),
    ),
  );
  app.post("/api/v1/organizations/:id/submit", async (req) =>
    organizationDrafts.submit(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      organizationSubmitInput.parse(req.body).version,
    ),
  );
  app.get("/api/v1/occurrences/:id/inventory", async (req) =>
    inventory.availability(uuid.parse((req.params as { id: string }).id)),
  );
  app.post("/api/v1/reservations", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const input = z
      .object({
        items: z
          .array(
            z
              .object({
                occurrenceId: uuid,
                resourceId: z.string().min(1).max(100),
                quantity: z.number().int().positive(),
              })
              .strict(),
          )
          .max(8),
      })
      .strict()
      .parse(req.body);
    return reservations.reserve(
      actor.id,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      input.items,
    );
  });
  app.get("/api/v1/reservations/:id", async (req) =>
    reservations.get(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.delete("/api/v1/reservations/:id", async (req) =>
    reservations.release(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  const publicVenue = new PublicVenue(
    new PostgresPublicVenue(),
    providers,
    new PostgresVenueSessions(),
  );
  const venueFavorites = new VenueFavorites(
    new PostgresVenueFavorites(),
    publicVenue,
  );
  app.get("/api/v1/venue-favorites", async (req) =>
    venueFavorites.list(
      (await identity.authenticate(req.cookies.session)).id,
      venueFavoriteFilters.parse(req.query).after,
    ),
  );
  app.get("/api/v1/venue-favorites/:id", async (req) =>
    venueFavorites.status(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.put("/api/v1/venue-favorites/:id", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return venueFavorites.save(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.delete("/api/v1/venue-favorites/:id", async (req) =>
    venueFavorites.remove(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.get("/api/v1/venues/:id", async (req) =>
    publicVenue.read(
      uuid.parse((req.params as { id: string }).id),
      publicVenueFilters.parse(req.query).after,
    ),
  );
  app.get("/api/v1/catalog/:id/occurrences", async (req) => ({
    items: await schedule.forListing(
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.get("/api/v1/organizations/:id/listings", async (req) => ({
    items: await managedCatalog.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.post("/api/v1/organizations/:id/listings", async (req) =>
    managedCatalog.create(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      listingInput.parse(req.body),
      listingCreationKey.parse(req.headers["idempotency-key"]),
    ),
  );
  app.put("/api/v1/listings/:id", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const { version, ...input } = listingUpdate.parse(req.body);
    return managedCatalog.update(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      version,
      input,
    );
  });
  app.post("/api/v1/listings/:id/submit", async (req) =>
    managedCatalog.submit(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      listingSubmitInput.parse(req.body).version,
    ),
  );
  app.post("/api/v1/occurrences/series/preview", async (req) =>
    schedule.previewSeries(
      (await identity.authenticate(req.cookies.session)).id,
      scheduleSeriesInput.parse(req.body),
    ),
  );
  app.post("/api/v1/occurrences/series", async (req) =>
    schedule.createSeries(
      (await identity.authenticate(req.cookies.session)).id,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      scheduleSeriesInput.parse(req.body),
    ),
  );
  app.post("/api/v1/occurrences", async (req) =>
    schedule.create(
      (await identity.authenticate(req.cookies.session)).id,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      scheduleInput.parse(req.body),
    ),
  );
  app.get("/api/v1/organizations/:id/occurrences", async (req) => ({
    items: await schedule.forOrganization(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  }));
  app.get("/api/v1/organizations/:id/venues", async (req) =>
    venues.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.post("/api/v1/organizations/:id/venues", async (req) =>
    venues.create(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      venueInput.parse(req.body),
    ),
  );
  app.post("/api/v1/organizations/:id/venues/:venueId/guidance", async (req) =>
    venues.guidance(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      uuid.parse((req.params as { venueId: string }).venueId),
      venueGuidanceInput.parse(req.body),
    ),
  );
  app.post("/api/v1/organizations/:id/venues/:venueId/contact", async (req) =>
    venues.contact(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      uuid.parse((req.params as { venueId: string }).venueId),
      venueContactInput.parse(req.body),
    ),
  );
  app.post("/api/v1/organizations/:id/venues/:venueId/media", async (req) =>
    venues.media(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      uuid.parse((req.params as { venueId: string }).venueId),
      venueMediaInput.parse(req.body),
    ),
  );
  app.post("/api/v1/organizations/:id/venues/:venueId/spaces", async (req) =>
    venues.space(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      uuid.parse((req.params as { venueId: string }).venueId),
      spaceInput.parse(req.body),
    ),
  );
  app.post(
    "/api/v1/organizations/:id/spaces/:spaceId/plans",
    { bodyLimit: 1048576 },
    async (req) =>
      venues.plan(
        (await identity.authenticate(req.cookies.session)).id,
        uuid.parse((req.params as { id: string }).id),
        uuid.parse((req.params as { spaceId: string }).spaceId),
        planInput.parse(req.body),
      ),
  );
  app.get("/api/v1/admin/providers", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return providerReview.page(reviewQueueFilters.parse(req.query));
  });
  app.get("/api/v1/admin/listings", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return managedCatalog.queuePage(listingQueueFilters.parse(req.query));
  });
  app.get("/api/v1/admin/reviews", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return {
      providers: await providerReview.queue(),
      listings: await managedCatalog.queue(),
    };
  });
  const reviewHistory = new ReviewHistory(
    new PostgresReviewHistory(
      new PostgresAudit(),
      new PostgresStaffAuthorization(),
    ),
  );
  app.get("/api/v1/organizations/:id/reviews", async (req) =>
    reviewHistory.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      false,
      reviewHistoryFilters.parse(req.query).beforeVersion,
    ),
  );
  app.get("/api/v1/admin/providers/:id/reviews", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return reviewHistory.list(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      true,
      reviewHistoryFilters.parse(req.query).beforeVersion,
    );
  });
  app.post("/api/v1/admin/providers/:id/review", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    const b = providerReviewInput.parse(req.body);
    return providerReview.review(
      uuid.parse((req.params as { id: string }).id),
      b.version,
      b.state,
      b.reason,
      actor.id,
    );
  });
  const listingRevisions = new ListingRevisionHistory(
    new PostgresListingRevisionHistory(
      new PostgresAudit(),
      new PostgresStaffAuthorization(),
      providers,
    ),
  );
  app.get("/api/v1/listings/:id/revisions", async (req) =>
    listingRevisions.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      false,
      listingRevisionFilters.parse(req.query).beforeId,
    ),
  );
  app.get("/api/v1/admin/listings/:id/revisions", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return listingRevisions.list(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      true,
      listingRevisionFilters.parse(req.query).beforeId,
    );
  });
  app.get("/api/v1/listings/:id/revisions/compare", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      input = listingRevisionComparisonInput.parse(req.query);
    return listingRevisions.compare(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      false,
      input.fromId,
      input.toId,
    );
  });
  app.get("/api/v1/admin/listings/:id/revisions/compare", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    const input = listingRevisionComparisonInput.parse(req.query);
    return listingRevisions.compare(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      true,
      input.fromId,
      input.toId,
    );
  });
  const listingHistory = new ListingReviewHistory(
    new PostgresListingReviewHistory(
      new PostgresAudit(),
      new PostgresStaffAuthorization(),
      providers,
    ),
  );
  app.get("/api/v1/listings/:id/reviews", async (req) =>
    listingHistory.list(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      false,
      listingReviewHistoryFilters.parse(req.query).beforeVersion,
    ),
  );
  app.get("/api/v1/admin/listings/:id/reviews", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    return listingHistory.list(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      true,
      listingReviewHistoryFilters.parse(req.query).beforeVersion,
    );
  });
  app.post("/api/v1/admin/listings/:id/review", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "moderate");
    const b = listingReviewInput.parse(req.body);
    return managedCatalog.review(
      uuid.parse((req.params as { id: string }).id),
      b.version,
      b.state,
      b.reason,
      actor.id,
    );
  });
  app.get("/api/v1/admin/audit", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "audit");
    return new AuditHistory(new PostgresAuditSearch()).search(
      actor.id,
      auditFilters.parse(req.query),
    );
  });
  app.post("/api/v1/quotes", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return quotes.create(
      actor.id,
      quoteInputSchema.parse(req.body).reservationId,
    );
  });
  app.post("/api/v1/attendee-exports", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    identity.requireMfa(actor);
    return attendeeExports.request(
      actor.id,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      exportInput.parse(req.body),
    );
  });
  app.get("/api/v1/occurrences/:id/attendee-exports", async (req, reply) => {
    reply.header("Cache-Control", "private, no-store");
    return attendeeExports.list(
      (await identity.authenticate(req.cookies.session)).id,
      z.object({ id: z.string().uuid() }).parse(req.params).id,
    );
  });
  app.get("/api/v1/attendee-exports/:id/download", async (req, reply) => {
    const id = z.object({ id: z.string().uuid() }).parse(req.params).id;
    const actor = await identity.authenticate(req.cookies.session);
    identity.requireMfa(actor);
    const csv = await attendeeExports.download(actor.id, id);
    return reply
      .header("Cache-Control", "private, no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header(
        "Content-Disposition",
        `attachment; filename="attendees-${id}.csv"`,
      )
      .type("text/csv; charset=utf-8")
      .send(csv);
  });
  app.get("/api/v1/occurrences/:id/online-access", async (req) =>
    onlineAccess.configuration(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.put("/api/v1/occurrences/:id/online-access", async (req) =>
    onlineAccess.configure(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      onlineSettings.parse(req.body),
    ),
  );
  app.get("/api/v1/bookings/:id/online-access/:occurrenceId", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      p = req.params as { id: string; occurrenceId: string };
    return onlineAccess.access(
      actor.id,
      uuid.parse(p.id),
      uuid.parse(p.occurrenceId),
    );
  });
  app.post("/api/v1/bookings/:id/online-access/:occurrenceId", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      p = req.params as { id: string; occurrenceId: string };
    z.object({}).strict().parse(req.body);
    return onlineAccess.access(
      actor.id,
      uuid.parse(p.id),
      uuid.parse(p.occurrenceId),
      true,
    );
  });
  app.get("/api/v1/occurrences/:id/registration-form", async (req) =>
    forms.list(
      (await identity.authenticate(req.cookies.session)).id,
      z.object({ id: z.string().uuid() }).parse(req.params).id,
    ),
  );
  app.put("/api/v1/occurrences/:id/registration-form", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      input = publishForm.parse(req.body);
    return forms.publish(
      actor.id,
      z.object({ id: z.string().uuid() }).parse(req.params).id,
      input.expectedVersion,
      input.definition,
    );
  });
  app.get("/api/v1/reservations/:id/registration-form", async (req) =>
    registrationPreview(
      (await identity.authenticate(req.cookies.session)).id,
      z.object({ id: z.string().uuid() }).parse(req.params).id,
    ),
  );
  app.get("/api/v1/bookings/:id/registration", async (req) =>
    registrations.get(
      (await identity.authenticate(req.cookies.session)).id,
      z.object({ id: z.string().uuid() }).parse(req.params).id,
    ),
  );
  app.post("/api/v1/orders", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return placement.accept(
      actor.id,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      placementInputSchema.parse(req.body),
    );
  });
  app.get("/api/v1/admin/pricing/policies", async (req) => {
    await identity.require(
      await identity.authenticate(req.cookies.session),
      "pricing",
    );
    return { items: await policies.list() };
  });
  app.post("/api/v1/admin/pricing/policies", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "pricing");
    return policies.create(actor.id, policyInputSchema.parse(req.body));
  });
  app.get("/api/v1/admin/pricing/occurrences/:id", async (req) => {
    await identity.require(
      await identity.authenticate(req.cookies.session),
      "pricing",
    );
    return {
      assignment: await policies.assignment(
        uuid.parse((req.params as { id: string }).id),
      ),
    };
  });
  app.put("/api/v1/admin/pricing/occurrences/:id", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "pricing");
    const input = assignmentInputSchema.parse(req.body);
    return policies.assign(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      input.policyId,
      input.expectedVersion,
    );
  });
  app.post("/api/v1/bookings/:id/payment", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return collection.initiate(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.get("/api/v1/bookings/:id/payment", async (req) =>
    collection.status(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.post("/api/v1/bookings/:id/payment/reconcile", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    paymentInitiationSchema.parse(req.body);
    return collection.requestRecovery(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.post("/api/v1/bookings/:id/payment/callback", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const input = paymentCallbackSchema.parse(req.body);
    return collection.callback(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      input.paymentId,
      input.signature,
      input.providerOrderId,
    );
  });
  app.get("/api/v1/bookings", async (req) =>
    new BookingHistory(new PostgresHistory()).search(
      (await identity.authenticate(req.cookies.session)).id,
      historyFilters.parse(req.query),
    ),
  );
  const paymentHistory = new BookingPaymentHistory(bookings, new PostgresPaymentHistory());
  app.get("/api/v1/bookings/:id/payment-history", async(req)=>{
    const actor=await identity.authenticate(req.cookies.session);
    const filters=paymentHistoryFilters.parse(req.query);
    return paymentHistory.get(actor.id,uuid.parse((req.params as {id:string}).id),filters.after,{category:filters.category,attemptId:filters.attemptId});
  });
  const bookingTimeline = new BookingTimeline(new PostgresBookingTimeline());
  app.get("/api/v1/bookings/:id/timeline", async (req) => {
    const actor=await identity.authenticate(req.cookies.session);
    z.object({}).strict().parse(req.query);
    return bookingTimeline.get(actor.id, uuid.parse((req.params as {id:string}).id));
  });
  app.get("/api/v1/bookings/:id", async (req) =>
    bookings.get(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.post("/api/v1/bookings/:id/pending-cancellation/preview", async (req) => {
    z.object({})
      .strict()
      .parse(req.body ?? {});
    return pendingCancellation.preview(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.post("/api/v1/bookings/:id/pending-cancellation", async (req) =>
    pendingCancellation.cancel(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      pendingCancelInput.parse(req.body),
    ),
  );
  app.get("/api/v1/bookings/:id/tickets", async (req) =>
    wallet.view(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.get("/api/v1/bookings/:id/tickets/download", async (req, reply) => {
    const id = uuid.parse((req.params as { id: string }).id),
      document = await wallet.document(
        (await identity.authenticate(req.cookies.session)).id,
        id,
      );
    return reply
      .header("Cache-Control", "private, no-store")
      .header(
        "Content-Disposition",
        `attachment; filename="tickets-${id}.html"`,
      )
      .header(
        "Content-Security-Policy",
        "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox",
      )
      .type("text/html; charset=utf-8")
      .send(ticketDocument(document));
  });
  app.get("/api/v1/bookings/:id/calendar", async (req, reply) => {
    const id = uuid.parse((req.params as { id: string }).id),
      calendar = await wallet.calendar(
        (await identity.authenticate(req.cookies.session)).id,
        id,
      );
    return reply
      .header("Cache-Control", "private, no-store")
      .header("Content-Disposition", `attachment; filename="booking-${id}.ics"`)
      .type("text/calendar; charset=utf-8")
      .send(calendar);
  });
  app.post("/api/v1/scanner/admissions", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    const b = z
      .object({
        occurrenceId: uuid,
        gate: z.string().min(1).max(100),
        token: z.string().min(10).max(200),
      })
      .strict()
      .parse(req.body);
    await identity.require(actor, "admit", `${b.occurrenceId}:${b.gate}`);
    return tickets.admit(
      actor.id,
      b.occurrenceId,
      b.gate,
      b.token,
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
    );
  });
  const notificationDeliveries = new PostgresConsumer();
  app.get("/api/v1/operations/notification-deliveries", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    await identity.require(actor, "support");
    return { items: await notificationDeliveries.failures() };
  });
  app.post(
    "/api/v1/operations/notification-deliveries/:id/replay",
    async (req) => {
      const actor = await identity.authenticate(req.cookies.session);
      await identity.require(actor, "support");
      const body = z
        .object({ reason: z.string().trim().min(5).max(2000) })
        .strict()
        .parse(req.body);
      return notificationDeliveries.replay(
        actor.id,
        uuid.parse((req.params as { id: string }).id),
        body.reason,
      );
    },
  );
  const notifications = notificationService();
  app.get("/api/v1/notifications", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      q = notificationFilters.parse(req.query);
    return notifications.list(
      actor.id,
      q.after,
      q.status === "unread" || q.unread === "true",
      q.category,
      q.status === "read",
      { fromDate: q.fromDate, toDate: q.toDate },
    );
  });
  app.post("/api/v1/notifications/unread", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return notifications.unreadMany(
      actor.id,
      notificationReadMany.parse(req.body).ids,
    );
  });
  app.post("/api/v1/notifications/read", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return notifications.readMany(
      actor.id,
      notificationReadMany.parse(req.body).ids,
    );
  });
  app.delete("/api/v1/notifications/:id/read", async (req) =>
    notifications.unread(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
    ),
  );
  app.post("/api/v1/notifications/:id/read", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    z.object({}).strict().parse(req.body);
    return notifications.read(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.post("/api/v1/bookings/:id/free-confirmation", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    freeConfirmationInput.parse(req.body);
    return freeConfirmation.confirm(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
    );
  });
  app.post("/api/v1/bookings/:id/free-cancellation/preview", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    z.object({}).strict().parse(req.body);
    return freeCancellation.preview(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
    );
  });
  app.post("/api/v1/bookings/:id/free-cancellation", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return freeCancellation.cancel(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      freeCancelInput.parse(req.body),
    );
  });
  const customerEscalation = new CustomerEscalation(
    new PostgresEscalation(new PostgresAudit()),
  );
  app.post("/api/v1/cases/:id/escalation", async (req) => {
    const actor = await identity.authenticate(req.cookies.session);
    return customerEscalation.request(
      actor.id,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      escalationInput.parse(req.body),
    );
  });
  app.get("/api/v1/cases", async (req) =>
    cases.list(
      (await identity.authenticate(req.cookies.session)).id,
      caseListFilters.parse(req.query),
    ),
  );
  app.post("/api/v1/cases", async (req) => {
    const actor = await identity.authenticate(req.cookies.session),
      b = createCaseInput.parse(req.body);
    return cases.create(
      actor.id,
      b.subject,
      b.category,
      b.body,
      b.bookingId,
      z
        .string()
        .min(8)
        .max(100)
        .optional()
        .parse(req.headers["idempotency-key"]),
    );
  });
  app.get("/api/v1/cases/:id/messages", async (req) =>
    cases.messages(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      false,
      messageFilters.parse(req.query).after,
    ),
  );
  app.post("/api/v1/cases/:id/messages", async (req) =>
    cases.reply(
      (await identity.authenticate(req.cookies.session)).id,
      uuid.parse((req.params as { id: string }).id),
      z
        .object({ body: z.string().min(1).max(5000) })
        .strict()
        .parse(req.body).body,
      "customer",
      false,
      z
        .string()
        .min(8)
        .max(100)
        .optional()
        .parse(req.headers["idempotency-key"]),
    ),
  );
  const supportDirectory = new SupportDirectory(
    identity,
    new PostgresSupportDirectory(new PostgresAudit()),
  );
  app.get("/api/v1/operations/support-agents", async (req) =>
    supportDirectory.search(
      req.cookies.session,
      supportDirectoryFilters.parse(req.query),
    ),
  );
  const supportAssignment = new SupportAssignment(
    identity,
    new PostgresAssignment(
      new PostgresStaffAuthorization(),
      new PostgresAudit(),
      new PostgresEvents(),
    ),
  );
  app.post("/api/v1/operations/cases/:id/assignment", async (req) =>
    supportAssignment.assign(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      z.string().min(8).max(100).parse(req.headers["idempotency-key"]),
      supportAssignmentInput.parse(req.body),
    ),
  );
  const supportOperations = new SupportOperations(
    identity,
    new PostgresSupportOperations(
      new PostgresAudit(),
      new PostgresSupportBookingReader(),
      new PostgresEvents(),
    ),
  );
  app.get("/api/v1/operations/cases", async (req) =>
    supportOperations.queue(req.cookies.session, caseFilters.parse(req.query)),
  );
  app.get("/api/v1/operations/cases/:id", async (req) =>
    supportOperations.detail(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      messageFilters.parse(req.query).after,
    ),
  );
  app.post("/api/v1/operations/cases/:id/actions", async (req) =>
    supportOperations.change(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      caseCommand.parse(req.body),
      z
        .string()
        .min(8)
        .max(100)
        .optional()
        .parse(req.headers["idempotency-key"]),
    ),
  );
  app.post("/api/v1/operations/cases/:id/messages", async (req) =>
    supportOperations.reply(
      req.cookies.session,
      uuid.parse((req.params as { id: string }).id),
      staffReply.parse(req.body),
      z
        .string()
        .min(8)
        .max(100)
        .optional()
        .parse(req.headers["idempotency-key"]),
    ),
  );
  app.get("/api/v1/operations/ledger", async (req) => {
    await identity.require(
      await identity.authenticate(req.cookies.session),
      "finance",
    );
    return { items: await finance.journals() };
  });
  await app.register(async (webhook) => {
    webhook.removeContentTypeParser("application/json");
    webhook.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req, body, done) => done(null, body),
    );
    webhook.post("/api/v1/payments/webhook", async (req) =>
      ingestWebhook(
        req.body as Buffer,
        String(req.headers["x-razorpay-signature"] ?? ""),
        req.headers["x-razorpay-event-id"] as string | undefined,
      ),
    );
  });
  if (existsSync(resolve("dist/index.html"))) {
    await app.register(serveStatic, { root: resolve("dist") });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply
            .code(404)
            .send({ code: "NOT_FOUND", message: "API route not found." })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
