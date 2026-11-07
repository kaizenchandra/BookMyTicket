import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
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
for (const kind of ["cinema", "sports"] as const)
  test(`${kind}: provider draft to published schedule, customer reservation, free booking, tickets and cancellation`, async () => {
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
          kind,
        }),
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
            kind: kind === "cinema" ? "screen" : "stadium",
            physicalCapacity: 10,
            turnaroundMinutes: 15,
          },
        ),
      );
      const resource = {
        id: "A1",
        kind: kind === "cinema" ? "seat" : "pool",
        label: "Fixture section",
        section: "Main",
        row: "A",
        gate: "Gate A",
        capacity: kind === "cinema" ? 1 : 10,
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
      const reservation = await ok(
        request(
          "POST",
          "/api/v1/reservations",
          {
            items: [
              { occurrenceId: occurrence.id, resourceId: "A1", quantity: 1 },
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
      const order = await ok(
        request(
          "POST",
          "/api/v1/orders",
          {
            reservationId: reservation.id,
            quoteId: quote.id,
            acceptPolicies: true,
          },
          buyer,
        ),
      );
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
      const wallet = await ok(
        request(
          "GET",
          `/api/v1/bookings/${order.id}/tickets`,
          undefined,
          buyer,
        ),
      );
      assert.equal(wallet.items.length, 1);
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
      assert.equal(
        (await ok(request("GET", `/api/v1/catalog/${draft.id}/occurrences`)))
          .items[0].available_units,
        resource.capacity,
      );
    } finally {
      await app.close();
    }
  });
