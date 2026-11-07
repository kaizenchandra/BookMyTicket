// Explicitly requested LOCAL DEMO data. Never run against production.
import { randomUUID } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "./migrate.ts";
import { PostgresProviders } from "../src/modules/providers/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import { PostgresCategoryDrafts } from "../src/modules/catalog/adapters/category-drafts.ts";
import { PostgresCatalogManagement } from "../src/modules/catalog/adapters/manage.ts";
import { Movies } from "../src/modules/cinema/application/movies.ts";
import { PostgresMovies } from "../src/modules/cinema/adapters/postgres.ts";
import { Fixtures } from "../src/modules/sports/application/fixtures.ts";
import { PostgresFixtures } from "../src/modules/sports/adapters/postgres.ts";
import { PostgresVenues } from "../src/modules/venues/adapters/postgres.ts";
import { PostgresAudit } from "../src/modules/reporting/adapters/audit.ts";
import { Scheduling } from "../src/modules/inventory/application/scheduling.ts";
import { PostgresSchedule } from "../src/modules/inventory/adapters/schedule.ts";
import { Policies } from "../src/modules/pricing/application/policies.ts";
import { PostgresPolicies } from "../src/modules/pricing/adapters/policies.ts";
import { PostgresPolicyTarget } from "../src/modules/inventory/adapters/policy-target.ts";
import type { Plan } from "../src/modules/venues/domain/plan.ts";
const demoMovies = [
  {
    title: "Neon Monsoon",
    city: "Bengaluru",
    language: "Kannada",
    genre: "Sci-Fi",
    durationMinutes: 132,
    cast: "Mira Rao, Arjun Dev",
    crew: "Director: Leela Sen",
    poster: "neon-monsoon",
  },
  {
    title: "The Last Metro",
    city: "Mumbai",
    language: "Hindi",
    genre: "Thriller",
    durationMinutes: 118,
    cast: "Kabir Shah, Tara Mehta",
    crew: "Director: Rohan Kale",
    poster: "last-metro",
  },
  {
    title: "A Map of Stars",
    city: "Bengaluru",
    language: "English",
    genre: "Adventure",
    durationMinutes: 125,
    cast: "Anya Roy, Dev Anand Rao",
    crew: "Director: Kavya Das",
    poster: "map-of-stars",
  },
  {
    title: "Midnight Marina",
    city: "Chennai",
    language: "Tamil",
    genre: "Drama",
    durationMinutes: 142,
    cast: "Nila Kumar, Adi Raman",
    crew: "Director: Sahana Ravi",
    poster: "midnight-marina",
  },
];
const demoSports = [
  {
    title: "Bengaluru Falcons vs Mumbai Mariners",
    city: "Bengaluru",
    sport: "Cricket",
    competition: "Demo Premier Cup",
    homeTeam: "Bengaluru Falcons",
    awayTeam: "Mumbai Mariners",
    poster: "cricket-cup",
  },
  {
    title: "Mumbai Comets vs Delhi Strikers",
    city: "Mumbai",
    sport: "Football",
    competition: "Demo Football League",
    homeTeam: "Mumbai Comets",
    awayTeam: "Delhi Strikers",
    poster: "football-league",
  },
  {
    title: "Chennai Waves vs Hyderabad Arrows",
    city: "Chennai",
    sport: "Badminton",
    competition: "Demo Racquet Championship",
    homeTeam: "Chennai Waves",
    awayTeam: "Hyderabad Arrows",
    poster: "racquet-cup",
  },
];
async function seed() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.ALLOW_DEMO_SEED !== "1"
  )
    throw new Error(
      "Requires NODE_ENV=development and explicit ALLOW_DEMO_SEED=1.",
    );
  const hostname = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).hostname
    : process.env.PGHOST;
  if (
    !["localhost", "127.0.0.1", "::1", "[::1]", "database"].includes(
      hostname ?? "",
    )
  )
    throw new Error("Demo seed is restricted to local PostgreSQL hosts.");
  const db = (await pool.query("SELECT current_database() name")).rows[0].name;
  if (!["bookmyticket", "bookmyticket_dev", "bookmyticket_test"].includes(db))
    throw new Error("Only named local development/test databases are allowed.");
  await migrate();
  const providers = new PostgresProviders(),
    catalog = new PostgresCatalog(),
    drafts = new PostgresCategoryDrafts(providers),
    managed = new PostgresCatalogManagement(providers),
    audit = new PostgresAudit(),
    venues = new PostgresVenues(providers, audit),
    schedule = new Scheduling(
      new PostgresSchedule(providers, catalog, audit),
      providers,
      catalog,
      venues,
    ),
    policies = new Policies(new PostgresPolicies(), new PostgresPolicyTarget()),
    movies = new Movies(new PostgresMovies(drafts, catalog, providers)),
    sports = new Fixtures(new PostgresFixtures(drafts, catalog, providers));
  const owner = (
    await pool.query(
      "INSERT INTO identity.accounts(id,contact) VALUES($1,$2) ON CONFLICT(contact) DO UPDATE SET contact=EXCLUDED.contact RETURNING id",
      [randomUUID(), "demo-organizer@bookmyticket.test"],
    )
  ).rows[0].id;
  const summary: any[] = [];
  for (const [kind, records] of [
    ["cinema", demoMovies],
    ["sports", demoSports],
  ] as const) {
    let org = (
      await pool.query(
        "SELECT id FROM providers.organizations WHERE owner_id=$1 AND name=$2",
        [owner, `DEMO ${kind} organization`],
      )
    ).rows[0];
    if (!org) {
      org = await providers.create(owner, `DEMO ${kind} organization`, kind);
      await pool.query(
        "UPDATE providers.organizations SET state='approved',reason='USER-AUTHORIZED LOCAL DEMO SEED; NOT REAL PROVIDER APPROVAL',version=version+1 WHERE id=$1",
        [org.id],
      );
    }
    for (let index = 0; index < records.length; index++) {
      const record = records[index] as any,
        title = `[DEMO] ${record.title}`;
      let listing = (
        await pool.query(
          "SELECT id,state,version FROM catalog.listings WHERE organization_id=$1 AND title=$2",
          [org.id, title],
        )
      ).rows[0];
      if (!listing) {
        const common = {
          title,
          city: record.city,
          description: `Fictional local demonstration ${kind === "cinema" ? "film" : "sports fixture"}. ${record.title} is invented sample content, not a real event or real availability. Choose a free demo session to test reservation, confirmation, tickets and cancellation.`,
          posterUrl: `/demo/${record.poster}.svg`,
        };
        listing =
          kind === "cinema"
            ? await movies.save(owner, org.id, `demo-${record.poster}-v1`, {
                ...common,
                durationMinutes: record.durationMinutes,
                releaseDate: new Date().toISOString().slice(0, 10),
                certification: "Unrated (demo)",
                genre: record.genre,
                language: record.language,
                format: "2D",
                cast: record.cast + " (fictional)",
                crew: record.crew + " (fictional)",
              })
            : await sports.save(owner, org.id, `demo-${record.poster}-v1`, {
                ...common,
                sport: record.sport,
                competition: record.competition,
                season: "Demo season",
                homeTeam: record.homeTeam,
                awayTeam: record.awayTeam,
                entryInstructions:
                  "DEMO: arrive 30 minutes before start. No real venue entry is offered.",
                hospitality:
                  "Demo Pavilion includes a fictional lounge. No food, service or physical entitlement is sold.",
              });
      }
      if (["draft", "changes_requested"].includes(listing.state))
        listing = await managed.submit(owner, listing.id, listing.version);
      if (listing.state === "submitted")
        listing = await managed.review(
          listing.id,
          listing.version,
          "published",
          "USER-AUTHORIZED LOCAL DEMO PUBLICATION; FICTIONAL CONTENT",
        );
      await pool.query(
        'UPDATE catalog.listings SET metadata=metadata||\'{"demo":"true"}\'::jsonb WHERE id=$1',
        [listing.id],
      );
      let current = (
        (await schedule.forOrganization(owner, org.id)) as any[]
      ).filter((o) => o.listing_id === listing.id);
      if (!current.length) {
        const venue = await venues.create(owner, org.id, {
          name: `DEMO ${record.city} ${kind === "cinema" ? "Aurora Cinema" : "Arena"} ${index + 1}`,
          address: "Fictional demonstration venue — do not travel here",
          city: record.city,
          timeZone: "Asia/Kolkata",
          amenities: "Demo facilities: parking, refreshments",
          accessibility: "Step-free demo layout; wheelchair spaces labeled",
        });
        const space = await venues.space(owner, org.id, venue.id, {
          name: kind === "cinema" ? "Screen 1" : "Main stadium",
          kind: kind === "cinema" ? "screen" : "stadium",
          physicalCapacity: kind === "cinema" ? 48 : 240,
          turnaroundMinutes: 30,
        });
        const resources: Plan["resources"] =
          kind === "cinema"
            ? Array.from({ length: 48 }, (_, n) => ({
                id: `${String.fromCharCode(65 + Math.floor(n / 8))}${(n % 8) + 1}`,
                kind: "seat" as const,
                label: `${String.fromCharCode(65 + Math.floor(n / 8))}${(n % 8) + 1}`,
                section: n < 24 ? "Classic" : "Premium",
                row: String.fromCharCode(65 + Math.floor(n / 8)),
                gate: "Screen entrance",
                capacity: 1,
                x: 10 + (n % 8) * 11,
                y: 20 + Math.floor(n / 8) * 12,
                accessible: n === 0 || n === 1,
              }))
            : [
                ...Array.from({ length: 24 }, (_, n) => ({
                  id: `P${n + 1}`,
                  kind: "seat" as const,
                  label: `P${n + 1}`,
                  section: "Pavilion",
                  row: n < 12 ? "A" : "B",
                  gate: "Gate P",
                  capacity: 1,
                  x: 8 + (n % 12) * 7,
                  y: 20 + Math.floor(n / 12) * 16,
                  accessible: n < 2,
                })),
                {
                  id: "north",
                  kind: "pool" as const,
                  label: "North stand",
                  section: "North stand",
                  row: "",
                  gate: "Gate N",
                  capacity: 120,
                  x: 20,
                  y: 70,
                  accessible: true,
                },
                {
                  id: "south",
                  kind: "pool" as const,
                  label: "South stand",
                  section: "South stand",
                  row: "",
                  gate: "Gate S",
                  capacity: 96,
                  x: 70,
                  y: 70,
                  accessible: false,
                },
              ];
        const plan = await venues.plan(owner, org.id, space.id, {
          label: "DEMO version 1",
          expectedVersion: 1,
          configuration: {
            orientation:
              kind === "cinema" ? "SCREEN THIS WAY" : "FIELD OF PLAY",
            resources,
          },
        });
        const policy = (await policies.create(owner, {
          label: "DEMO explicit free/paid display policy",
          reason:
            "User-authorized local demo policy; no live payments for demo occurrences",
          configuration: {
            feePerOrderPaise: 0,
            feePerTicketPaise: 0,
            feeBasisPoints: 0,
            ticketTax: { basisPoints: 0, mode: "exclusive" },
            feeTax: { basisPoints: 0, mode: "exclusive" },
            allowFreeBookings: true,
            freeCancellationCutoffMinutes: 0,
            cancellationTerms:
              "DEMO only: unused free tickets may be fully cancelled before start. Paid demo listings do not collect payments.",
            admissionTerms:
              "DEMO only: tickets are test artifacts and grant no real-world admission.",
          },
        })) as any;
        for (let show = 0; show < 2; show++) {
          const start = new Date(Date.now() + (2 + index + show) * 86400000);
          start.setUTCHours(show ? 13 : 9, 0, 0, 0);
          const end = new Date(
            start.getTime() +
              (kind === "cinema" ? record.durationMinutes : 180) * 60000,
          );
          const occurrence = await schedule.create(
            owner,
            `demo-${listing.id}-${show}`,
            {
              organizationId: org.id,
              listingId: listing.id,
              planId: plan.id,
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
              salesOpen: new Date(Date.now() - 3600000).toISOString(),
              salesClose: start.toISOString(),
              demo: true,
              prices: Object.fromEntries(
                resources.map((r) => [
                  r.id,
                  show
                    ? kind === "cinema"
                      ? 19900
                      : r.kind === "seat"
                        ? 149900
                        : 49900
                    : 0,
                ]),
              ),
            },
          );
          await policies.assign(owner, occurrence.id, policy.id, 0);
        }
        current = (
          (await schedule.forOrganization(owner, org.id)) as any[]
        ).filter((o) => o.listing_id === listing.id);
      }
      summary.push({
        id: listing.id,
        title,
        city: record.city,
        kind,
        sessions: current.length,
        url: `/listing/${listing.id}`,
      });
    }
  }
  console.log(
    JSON.stringify(
      {
        label: "USER-AUTHORIZED FICTIONAL DEMO DATA",
        database: db,
        items: summary,
      },
      null,
      2,
    ),
  );
}
try {
  await seed();
} finally {
  await pool.end();
}
