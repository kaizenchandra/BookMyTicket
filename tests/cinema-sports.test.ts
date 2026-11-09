import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
import { commerce } from "../src/composition.ts";
import { fixturePolicy } from "./pricing-fixtures.ts";
if (
  new URL(process.env.DATABASE_URL ?? "http://invalid").pathname !==
  "/bookmyticket_test"
)
  throw new Error("Requires isolated test DB");
process.env.TICKET_ENCRYPTION_KEY = randomBytes(32).toString("hex");
process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
before(migrate);
after(() => pool.end());
async function actor(permissions: string[] = []) {
  const id = randomUUID(),
    token = randomBytes(32).toString("hex");
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    id,
    `${id}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO identity.sessions(token_hash,account_id,expires_at,mfa_verified,mfa_verified_at) VALUES($1,$2,now()+interval '1 hour',true,now())",
    [hashToken(token), id],
  );
  for (const p of permissions)
    await pool.query("INSERT INTO identity.grants VALUES($1,$2,'platform')", [
      id,
      p,
    ]);
  return { id, headers: { cookie: `session=${token}` } };
}
for (const scenario of ["cinema", "sports", "events", "events-seated"] as const)
  test(`${scenario}: provider draft to published schedule, customer reservation, free booking, tickets and cancellation`, async () => {
    const kind = scenario === "events-seated" ? "events" : scenario;
    const assigned = kind === "cinema" || scenario === "events-seated";
    const quantity = kind === "events" && !assigned ? 2 : 1;
    const owner = await actor(),
      admin = await actor(["moderate", "pricing"]),
      buyer = await actor(),
      app = await buildApp();
    const request = async (
      method: "GET" | "POST" | "PUT",
      url: string,
      payload?: any,
      who = owner,
      key = randomUUID(),
    ) =>
      app.inject({
        method,
        url,
        headers: { ...who.headers, "idempotency-key": key },
        ...(payload ? { payload } : {}),
      });
    const ok = async (p: ReturnType<typeof request>) => {
      const r = await p;
      assert.equal(r.statusCode, 200, r.body);
      return r.json();
    };
    try {
      const org = await ok(
        request("POST", "/api/v1/organizations", {
          name: "ISOLATED CATEGORY FIXTURE",
          kind: kind === "events" ? "event" : kind,
        }),
      );
      await pool.query(
        "INSERT INTO providers.onboarding_details(organization_id,legal_name,business_address,contact_name,contact_email) VALUES($1,'Fixture business','Fixture address','Fixture contact','fixture@example.invalid')",
        [org.id],
      );
      const submitted = await ok(
        request("POST", `/api/v1/organizations/${org.id}/submit`, {
          version: 1,
        }),
      );
      await ok(
        request(
          "POST",
          `/api/v1/admin/providers/${org.id}/review`,
          {
            version: submitted.version,
            state: "approved",
            reason: "Isolated provider review",
          },
          admin,
        ),
      );
      const common = {
        title: `ISOLATED ${kind} ${randomUUID()}`,
        city: "Fixture city",
        description: "Isolated category integration fixture",
        posterUrl: "/demo/neon-monsoon.svg",
      };
      const input =
        kind === "cinema"
          ? {
              ...common,
              durationMinutes: 120,
              releaseDate: "2026-01-01",
              certification: "U",
              genre: "Drama",
              language: "Hindi",
              format: "2D",
              cast: "Fixture performers",
              crew: "Fixture crew",
            }
          : kind === "events"
            ? {
                ...common,
                performers: "Fixture ensemble",
                organizer: "Fixture organizer",
                durationMinutes: 120,
                minimumAge: 12,
                genre: "Live music",
                language: "Hindi",
                inclusions: "One admission per ticket",
                exclusions: "Food excluded",
                entryInstructions: "Bring the ticket QR and attendee details",
              }
            : {
                ...common,
                sport: "Cricket",
                competition: "Fixture cup",
                season: "Fixture season",
                homeTeam: "Fixture team A",
                awayTeam: "Fixture team B",
                entryInstructions: "Fixture gate instructions",
                hospitality: "Fixture pavilion only",
              };
      const key = randomUUID(),
        draft = await ok(
          request(
            "POST",
            `/api/v1/organizations/${org.id}/${kind}`,
            input,
            owner,
            key,
          ),
        );
      const retainedKeys =
        kind === "cinema"
          ? ["crew"]
          : kind === "events"
            ? ["organizer", "inclusions", "exclusions", "entryInstructions"]
            : ["season", "homeTeam", "awayTeam", "hospitality"];
      const { movieInput } =
        await import("../src/modules/cinema/adapters/schema.ts");
      const { fixtureInput } =
        await import("../src/modules/sports/adapters/schema.ts");
      const { eventInput } =
        await import("../src/modules/events/adapters/catalog-schema.ts");
      const parsed: any = (
        kind === "cinema"
          ? movieInput
          : kind === "events"
            ? eventInput
            : fixtureInput
      ).parse(input);
      const oldMetadata =
        kind === "cinema"
          ? {
              managedBy: "cinema",
              language: parsed.language,
              genre: parsed.genre,
              format: parsed.format,
              certification: parsed.certification,
              duration: String(parsed.durationMinutes) + " min",
              performers: parsed.cast,
              releaseDate: parsed.releaseDate,
            }
          : kind === "events"
            ? {
                managedBy: "events",
                language: parsed.language,
                genre: parsed.genre,
                duration: String(parsed.durationMinutes) + " min",
                performers: parsed.performers,
                minimumAge: String(parsed.minimumAge),
              }
            : {
                managedBy: "sports",
                sport: parsed.sport,
                competition: parsed.competition,
                teams: parsed.homeTeam + " vs " + parsed.awayTeam,
                entryInstructions: parsed.entryInstructions,
              };
      const oldEnvelope = {
        kind:
          kind === "cinema" ? "movie" : kind === "events" ? "event" : "sports",
        input: {
          requestFingerprint: createHash("sha256")
            .update(JSON.stringify(parsed))
            .digest("hex"),
          title: parsed.title,
          city: parsed.city,
          description: parsed.description,
          posterUrl: parsed.posterUrl,
          metadata: oldMetadata,
        },
      };
      assert.equal(
        (
          await pool.query(
            "SELECT fingerprint FROM catalog.category_commands WHERE owner_id=$1 AND organization_id=$2 AND operation_key=$3",
            [owner.id, org.id, key],
          )
        ).rows[0].fingerprint,
        createHash("sha256").update(JSON.stringify(oldEnvelope)).digest("hex"),
        "Projection expansion preserves pre-upgrade retry fingerprint",
      );
      assert.equal(
        (await request("GET", `/api/v1/catalog/${draft.id}/${kind}`))
          .statusCode,
        404,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/api/v1/organizations/${org.id}/${kind}`,
            input,
            buyer,
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/api/v1/organizations/${org.id}/${kind}`,
            {
              ...input,
              ...(kind === "cinema"
                ? { crew: "Changed crew" }
                : kind === "events"
                  ? { exclusions: "Changed exclusions" }
                  : { hospitality: "Changed benefits" }),
            },
            owner,
            key,
          )
        ).statusCode,
        409,
      );
      const changed = {
        ...input,
        description: "Updated isolated category fixture description",
        ...(kind === "cinema"
          ? { crew: "Updated crew" }
          : kind === "events"
            ? { exclusions: "Updated exclusions" }
            : { hospitality: "Updated hospitality" }),
        version: draft.version,
      };
      const edited = await ok(
        request(
          "PUT",
          `/api/v1/organizations/${org.id}/${kind}/${draft.id}`,
          changed,
        ),
      );
      await ok(
        request(
          "POST",
          `/api/v1/organizations/${org.id}/${kind}`,
          input,
          owner,
          key,
        ),
      );
      const records = await ok(
        request("GET", `/api/v1/organizations/${org.id}/${kind}`),
      );
      assert.equal(
        records.items[0].details.description,
        changed.description,
        "replay must not overwrite newer category data",
      );
      const revisionHistorySnapshot = await ok(
        request("GET", `/api/v1/listings/${draft.id}/revisions`),
      );
      for (const field of retainedKeys)
        assert.equal(
          revisionHistorySnapshot.items[0].snapshot.categoryDetails[field],
          parsed[field],
          `Saved original ${field}`,
        );
      assert.equal(
        revisionHistorySnapshot.items.length,
        1,
        "Identical create replay adds no revisions",
      );
      const listingSubmitted = await ok(
        request("POST", `/api/v1/listings/${draft.id}/submit`, {
          version: edited.version,
        }),
      );
      await ok(
        request(
          "POST",
          `/api/v1/admin/listings/${draft.id}/review`,
          {
            version: listingSubmitted.version,
            state: "published",
            reason: "Isolated listing review",
          },
          admin,
        ),
      );
      const retainedHistory = await ok(
        request("GET", `/api/v1/listings/${draft.id}/revisions`),
      );
      const compareHistory = await ok(
        request(
          "GET",
          `/api/v1/listings/${draft.id}/revisions/compare?fromId=${revisionHistorySnapshot.items[0].id}&toId=${retainedHistory.items[0].id}`,
        ),
      );
      const changedRetainedField =
        kind === "cinema"
          ? "crew"
          : kind === "events"
            ? "exclusions"
            : "hospitality";
      assert(
        compareHistory.changes.some(
          (change: any) =>
            change.field === `categoryDetails.${changedRetainedField}` &&
            change.before === parsed[changedRetainedField] &&
            change.after === (changed as any)[changedRetainedField],
        ),
      );
      const publicDetail = await ok(
        request("GET", `/api/v1/catalog/${draft.id}/${kind}`),
      );
      assert.equal(publicDetail.details.title, input.title);
      const venue = await ok(
        request("POST", `/api/v1/organizations/${org.id}/venues`, {
          name: "Fixture venue",
          address: "Fixture address",
          city: "Fixture city",
          timeZone: "Asia/Kolkata",
          amenities: "",
          accessibility: "Step-free fixture",
        }),
      );
      const space = await ok(
        request(
          "POST",
          `/api/v1/organizations/${org.id}/venues/${venue.id}/spaces`,
          {
            name: "Fixture space",
            kind:
              kind === "cinema"
                ? "screen"
                : kind === "events"
                  ? "hall"
                  : "stadium",
            physicalCapacity: 10,
            turnaroundMinutes: 15,
          },
        ),
      );
      const resource = {
        id: "A1",
        kind: assigned ? "seat" : "pool",
        label: "Fixture section",
        section: "Main",
        row: "A",
        gate: "Gate A",
        capacity: assigned ? 1 : 10,
        x: 20,
        y: 20,
        accessible: true,
      };
      const plan = await ok(
        request(
          "POST",
          `/api/v1/organizations/${org.id}/spaces/${space.id}/plans`,
          {
            label: "Fixture plan",
            expectedVersion: 1,
            configuration: {
              orientation: "SCREEN / FIELD",
              resources: [resource],
            },
          },
        ),
      );
      const start = new Date(Date.now() + 86400000),
        end = new Date(start.getTime() + 7200000);
      const schedule = {
        organizationId: org.id,
        listingId: draft.id,
        planId: plan.id,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        salesOpen: new Date(Date.now() - 3600000).toISOString(),
        salesClose: start.toISOString(),
        prices: { A1: 0 },
        demo: true,
      };
      const occurrence = await ok(
        request("POST", "/api/v1/occurrences", schedule),
      );
      assert.equal(
        (await request("POST", "/api/v1/occurrences", schedule)).statusCode,
        409,
        "overlap must reject",
      );
      let attendeeForm: any;
      const definition = {
        title: "Event attendee registration",
        instructions: "Details for this admission only",
        fields: [
          {
            id: "name",
            label: "Attendee name",
            purpose: "Identify the attendee",
            type: "text",
            required: true,
            maxLength: 80,
            options: [],
          },
          {
            id: "age_acknowledged",
            label: "I meet the minimum age requirement",
            purpose: "Entry eligibility declaration",
            type: "checkbox",
            required: true,
            maxLength: 10,
            options: [],
          },
        ],
      };
      if (kind === "events") {
        const secondStart = new Date(start.getTime() + 86400000);
        await ok(
          request("POST", "/api/v1/occurrences", {
            ...schedule,
            startsAt: secondStart.toISOString(),
            endsAt: new Date(secondStart.getTime() + 7200000).toISOString(),
            salesClose: secondStart.toISOString(),
          }),
        );
        attendeeForm = await ok(
          request(
            "PUT",
            `/api/v1/occurrences/${occurrence.id}/registration-form`,
            { expectedVersion: 0, definition },
          ),
        );
        assert.equal(
          (
            await request(
              "PUT",
              `/api/v1/occurrences/${occurrence.id}/registration-form`,
              { expectedVersion: 1, definition },
              buyer,
            )
          ).statusCode,
          403,
        );
      }
      const policy = await ok(
        request(
          "POST",
          "/api/v1/admin/pricing/policies",
          {
            label: "Fixture approved free policy",
            reason: "Isolated test approval",
            configuration: {
              ...fixturePolicy,
              allowFreeBookings: true,
              freeCancellationCutoffMinutes: 0,
            },
          },
          admin,
        ),
      );
      await ok(
        request(
          "PUT",
          `/api/v1/admin/pricing/occurrences/${occurrence.id}`,
          { policyId: policy.id, expectedVersion: 0 },
          admin,
        ),
      );
      const sessions = await ok(
        request("GET", `/api/v1/catalog/${draft.id}/occurrences`),
      );
      assert.equal(sessions.items[0].is_demo, true);
      assert.equal(sessions.items[0].available_units, resource.capacity);
      if (kind === "events") {
        const upcoming = await ok(
          request(
            "GET",
            `/api/v1/catalog?kind=event&upcoming=true&q=${encodeURIComponent(input.title)}`,
          ),
        );
        assert.equal(upcoming.items.length, 1);
        assert.equal(
          upcoming.items[0].nextSession.startsAt,
          start.toISOString(),
        );
        assert.equal(upcoming.items[0].nextSession.timeZone, "Asia/Kolkata");
      }
      const reservation = await ok(
        request(
          "POST",
          "/api/v1/reservations",
          {
            items: [
              {
                occurrenceId: occurrence.id,
                resourceId: "A1",
                quantity,
              },
            ],
          },
          buyer,
        ),
      );
      const quote = await ok(
        request(
          "POST",
          "/api/v1/quotes",
          { reservationId: reservation.id },
          buyer,
        ),
      );
      const registration = attendeeForm
        ? {
            formId: attendeeForm.id,
            answers: [
              { name: "Fixture attendee One", age_acknowledged: true },
              { name: "Fixture attendee Two", age_acknowledged: true },
            ].slice(0, quantity),
          }
        : undefined;
      if (kind === "events") {
        assert.equal(sessions.items.length, 2);
        const preview = await ok(
          request(
            "GET",
            `/api/v1/reservations/${reservation.id}/registration-form`,
            undefined,
            buyer,
          ),
        );
        assert.equal(preview.quantity, quantity);
        assert.equal(preview.form.id, attendeeForm.id);
        assert.equal(
          (
            await request(
              "POST",
              "/api/v1/orders",
              {
                reservationId: reservation.id,
                quoteId: quote.id,
                acceptPolicies: true,
              },
              buyer,
            )
          ).statusCode,
          409,
        );
        const invalid = await request(
          "POST",
          "/api/v1/orders",
          {
            reservationId: reservation.id,
            quoteId: quote.id,
            acceptPolicies: true,
            registration: {
              ...registration,
              answers: [
                { name: "One", age_acknowledged: false },
                { name: "Two", age_acknowledged: true },
              ],
            },
          },
          buyer,
        );
        assert.equal(invalid.statusCode, 422, invalid.body);
      }
      const order = await ok(
        request(
          "POST",
          "/api/v1/orders",
          {
            reservationId: reservation.id,
            quoteId: quote.id,
            acceptPolicies: true,
            ...(registration ? { registration } : {}),
          },
          buyer,
        ),
      );
      assert.equal(order.snapshot.occurrences[0].title, input.title);
      const renamedTitle = "ISOLATED RENAMED " + randomUUID();
      await pool.query("UPDATE catalog.listings SET title=$2 WHERE id=$1", [
        draft.id,
        renamedTitle,
      ]);
      const history = await ok(
        request(
          "GET",
          `/api/v1/bookings?q=${encodeURIComponent(input.title)}`,
          undefined,
          buyer,
        ),
      );
      assert.equal(history.items[0].occurrences[0].title, input.title);
      assert.equal(
        (
          await ok(
            request(
              "GET",
              `/api/v1/bookings?q=${encodeURIComponent(renamedTitle)}`,
              undefined,
              buyer,
            ),
          )
        ).items.length,
        0,
      );
      if (kind === "events") {
        await ok(
          request(
            "PUT",
            `/api/v1/occurrences/${occurrence.id}/registration-form`,
            {
              expectedVersion: 1,
              definition: { ...definition, title: "Revised registration" },
            },
          ),
        );
        const saved = await ok(
          request(
            "GET",
            `/api/v1/bookings/${order.id}/registration`,
            undefined,
            buyer,
          ),
        );
        assert.equal(saved.registration.form.version, 1);
        assert.deepEqual(saved.registration.answers, registration!.answers);
        assert.equal(
          (
            await request(
              "GET",
              `/api/v1/bookings/${order.id}/registration`,
              undefined,
              owner,
            )
          ).statusCode,
          404,
        );
      }
      if (kind === "events") {
        assert.equal(
          (
            await request(
              "POST",
              `/api/v1/bookings/${order.id}/online-access/${occurrence.id}`,
              {},
              buyer,
            )
          ).statusCode,
          409,
        );
      }
      await assert.rejects(
        commerce().paymentOrders.prepare(buyer.id, order.id, async () => {
          throw new Error("Must not contact payment provider");
        }),
        { code: "DEMO_PAYMENT_DISABLED" },
      );
      await ok(
        request(
          "POST",
          `/api/v1/bookings/${order.id}/free-confirmation`,
          { confirm: true },
          buyer,
        ),
      );
      if (kind === "events") {
        const configPath = `/api/v1/occurrences/${occurrence.id}/online-access`;
        const accessPath = `/api/v1/bookings/${order.id}/online-access/${occurrence.id}`;
        const link = `https://example.org/join/${randomUUID()}`;
        const settings = {
          expectedVersion: 0,
          url: link,
          enabled: true,
          opensAt: new Date(Date.now() - 60000).toISOString(),
          closesAt: new Date(Date.now() + 3600000).toISOString(),
        };
        assert.equal(
          (await request("PUT", configPath, settings, buyer)).statusCode,
          403,
        );
        assert.equal(
          (
            await request("PUT", configPath, {
              ...settings,
              url: "http://example.org",
            })
          ).statusCode,
          422,
        );
        const saved = await ok(request("PUT", configPath, settings));
        assert.equal(saved.configuration.version, 1);
        assert.ok(!JSON.stringify(saved).includes(link));
        assert.equal(
          (await request("PUT", configPath, settings)).statusCode,
          409,
        );
        const stored = await pool.query(
          "SELECT url_ciphertext FROM events.online_access WHERE occurrence_id=$1",
          [occurrence.id],
        );
        assert.ok(!stored.rows[0].url_ciphertext.includes(link));
        const status = await ok(request("GET", accessPath, undefined, buyer));
        assert.equal(status.allowed, true);
        assert.equal(status.url, undefined);
        assert.equal(
          (await ok(request("POST", accessPath, {}, buyer))).url,
          link,
        );
        assert.equal(
          (await request("POST", accessPath, {}, owner)).statusCode,
          404,
        );
        const { url, ...withoutLink } = settings;
        for (const [index, change, reason] of [
          [0, { enabled: false }, "disabled"],
          [
            1,
            { opensAt: new Date(Date.now() + 60000).toISOString() },
            "not_open",
          ],
          [
            2,
            {
              opensAt: new Date(Date.now() - 120000).toISOString(),
              closesAt: new Date(Date.now() - 60000).toISOString(),
            },
            "expired",
          ],
        ] as const) {
          await ok(
            request("PUT", configPath, {
              ...withoutLink,
              ...change,
              expectedVersion: index + 1,
            }),
          );
          assert.equal(
            (await ok(request("GET", accessPath, undefined, buyer))).reason,
            reason,
          );
          assert.equal(
            (await request("POST", accessPath, {}, buyer)).statusCode,
            409,
          );
        }
        await ok(
          request("PUT", configPath, { ...withoutLink, expectedVersion: 4 }),
        );
        assert.equal(
          (await ok(request("POST", accessPath, {}, buyer))).url,
          link,
        );
        assert.ok(
          !(
            await request("GET", `/api/v1/catalog/${draft.id}/occurrences`)
          ).body.includes(link),
        );
      }
      const wallet = await ok(
        request(
          "GET",
          `/api/v1/bookings/${order.id}/tickets`,
          undefined,
          buyer,
        ),
      );
      assert.equal(wallet.items.length, quantity);
      assert.ok(wallet.items[0].qrSvg);
      const preview = await ok(
        request(
          "POST",
          `/api/v1/bookings/${order.id}/free-cancellation/preview`,
          {},
          buyer,
        ),
      );
      await ok(
        request(
          "POST",
          `/api/v1/bookings/${order.id}/free-cancellation`,
          {
            previewId: preview.previewId,
            reason: "Isolated test complete",
            confirm: true,
          },
          buyer,
        ),
      );
      if (kind === "events") {
        assert.equal(
          (
            await request(
              "POST",
              `/api/v1/bookings/${order.id}/online-access/${occurrence.id}`,
              {},
              buyer,
            )
          ).statusCode,
          409,
        );
      }
      assert.equal(
        (await ok(request("GET", `/api/v1/catalog/${draft.id}/occurrences`)))
          .items[0].available_units,
        resource.capacity,
      );
    } finally {
      await app.close();
    }
  });
