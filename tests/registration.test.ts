import { quoteResponseSchema } from "../src/modules/pricing/adapters/schemas.ts";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { pool } from "../src/shared/database.ts";
import { migrate } from "../scripts/migrate.ts";
import { commerce } from "../src/composition.ts";
import { Reservations } from "../src/modules/inventory/application/reservations.ts";
import { PostgresReservations } from "../src/modules/inventory/adapters/postgres.ts";
import { PostgresCatalog } from "../src/modules/catalog/adapters/postgres.ts";
import {
  assignFixturePolicy,
  fixturePolicy,
  policies,
} from "./pricing-fixtures.ts";
import { buildApp } from "../src/app.ts";
import { hashToken } from "../src/modules/identity/adapters/postgres.ts";
if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
  throw new Error("Requires isolated test DB");
before(migrate);
after(() => pool.end());
process.env.REGISTRATION_ENCRYPTION_KEY = randomBytes(32).toString("hex");
const c = commerce(),
  reservations = new Reservations(
    new PostgresReservations(new PostgresCatalog()),
  );
async function fixture(approvedPolicy = true) {
  const owner = randomUUID(),
    org = randomUUID(),
    listing = randomUUID(),
    occurrence = randomUUID();
  await pool.query("INSERT INTO identity.accounts(id,contact) VALUES($1,$2)", [
    owner,
    `${owner}@fixture.invalid`,
  ]);
  await pool.query(
    "INSERT INTO providers.organizations(id,owner_id,name,kind,state) VALUES($1,$2,'PRICING TEST ONLY','event','approved')",
    [org, owner],
  );
  await pool.query(
    "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,state) VALUES($1,$2,'PRICING TEST ONLY','event','Test city','Isolated fixture','published')",
    [listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close) VALUES($1,$2,$3,'Pricing fixture venue','Asia/Kolkata',now()+interval '2 days',now()+interval '2 days 1 hour',now()-interval '1 day',now()+interval '1 day')",
    [occurrence, listing, org],
  );
  await pool.query(
    "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,'pool','pool','TEST POOL',20,101)",
    [occurrence],
  );
  const policyId = approvedPolicy
    ? await assignFixturePolicy(owner, occurrence, {
        ...fixturePolicy,
        feePerOrderPaise: 5,
        ticketTax: { basisPoints: 500, mode: "exclusive" },
      })
    : null;
  const hold = (await reservations.reserve(owner, randomUUID(), [
    { occurrenceId: occurrence, resourceId: "pool", quantity: 3 },
  ])) as any;
  return { owner, org, listing, occurrence, policyId, hold };
}

const definition = {
  title: "Participant details",
  instructions: "Isolated test form",
  fields: [
    {
      id: "name",
      label: "Name",
      purpose: "Identify the attendee at admission",
      type: "text" as const,
      required: true,
      maxLength: 80,
      options: [],
    },
  ],
};
test("registration versions, owner privacy, encrypted persistence and retry invariants", async () => {
  const f = await fixture();
  await pool.query(
    "INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",
    [f.org, f.owner],
  );
  const published = await c.forms.publish(f.owner, f.occurrence, 0, definition);
  await assert.rejects(c.forms.publish(f.owner, f.occurrence, 0, definition), {
    code: "VERSION_CONFLICT",
  });
  const quote = await c.quotes.create(f.owner, f.hold.id);
  const input = {
    reservationId: f.hold.id,
    quoteId: quote.id,
    acceptPolicies: true,
  };
  await assert.rejects(c.placement.accept(f.owner, randomUUID(), input), {
    code: "FORM_CHANGED",
  });
  await assert.rejects(
    c.placement.accept(f.owner, randomUUID(), {
      ...input,
      registration: { formId: published.id, answers: [{ name: "One" }] },
    }),
    { code: "ATTENDEE_COUNT" },
  );
  const registration = {
      formId: published.id,
      answers: [
        { name: "Private One" },
        { name: "Private Two" },
        { name: "Private Three" },
      ],
    },
    key = randomUUID();
  const order = (await c.placement.accept(f.owner, key, {
    ...input,
    registration,
  })) as any;
  assert.equal(
    (
      (await c.placement.accept(f.owner, key, {
        ...input,
        registration,
      })) as any
    ).id,
    order.id,
  );
  const changed = {
    ...registration,
    answers: [{ name: "Changed" }, ...registration.answers.slice(1)],
  };
  await assert.rejects(
    c.placement.accept(f.owner, key, { ...input, registration: changed }),
    { code: "IDEMPOTENCY_CONFLICT" },
  );
  await assert.rejects(
    c.placement.accept(f.owner, randomUUID(), {
      ...input,
      registration: changed,
    }),
    { code: "ORDER_ALREADY_EXISTS" },
  );
  const stored = (
    await pool.query("SELECT * FROM bookings.registrations WHERE order_id=$1", [
      order.id,
    ])
  ).rows[0];
  assert.ok(!stored.answers_ciphertext.includes("Private"));
  assert.ok(!JSON.stringify(order.snapshot).includes("Private"));
  assert.deepEqual(
    (await c.registrations.get(f.owner, order.id)).registration?.answers,
    registration.answers,
  );
  await assert.rejects(c.registrations.get(randomUUID(), order.id), {
    code: "NOT_FOUND",
  });
  await c.forms.publish(f.owner, f.occurrence, 1, {
    ...definition,
    title: "Revised form",
  });
  assert.equal(
    (await c.registrations.get(f.owner, order.id)).registration?.form.version,
    1,
  );
  assert.equal(
    (
      (await c.placement.accept(f.owner, key, {
        ...input,
        registration,
      })) as any
    ).id,
    order.id,
  );
  await assert.rejects(
    pool.query(
      "UPDATE events.registration_forms SET definition='{}' WHERE id=$1",
      [published.id],
    ),
  );
});

test("server rejects unknown, missing and malformed attendee fields", async () => {
  const { validateAnswers, validateDefinition } =
    await import("../src/modules/events/domain/registration.ts");
  assert.throws(() => validateAnswers(definition, 1, [{}]), {
    code: "ATTENDEE_VALIDATION",
  });
  assert.throws(
    () => validateAnswers(definition, 1, [{ name: "Person", extra: "secret" }]),
    { code: "ATTENDEE_FIELD" },
  );
  for (const [type, value] of [
    ["email", "not an email"],
    ["phone", "abc"],
    ["date", "2026-02-30"],
    ["checkbox", false],
    ["choice", "other"],
  ] as const) {
    const form = {
      ...definition,
      fields: [
        {
          ...definition.fields[0]!,
          type,
          options: type === "choice" ? ["allowed"] : [],
        },
      ],
    };
    assert.throws(() => validateAnswers(form, 1, [{ name: value }]), {
      code: "ATTENDEE_VALIDATION",
    });
  }
  assert.throws(
    () =>
      validateDefinition({
        ...definition,
        fields: [definition.fields[0]!, definition.fields[0]!],
      }),
    { code: "INVALID_FORM" },
  );
});

test('concurrent form publication has one winner; missing key cannot create an order',async()=>{
 const f=await fixture();await pool.query("INSERT INTO providers.memberships(organization_id,account_id,role) VALUES($1,$2,'owner')",[f.org,f.owner]);
 const results=await Promise.allSettled([c.forms.publish(f.owner,f.occurrence,0,definition),c.forms.publish(f.owner,f.occurrence,0,definition)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const form=(results.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any>).value;
 await assert.rejects(c.forms.list(randomUUID(),f.occurrence));
 const q=await c.quotes.create(f.owner,f.hold.id),saved=process.env.REGISTRATION_ENCRYPTION_KEY;
 delete process.env.REGISTRATION_ENCRYPTION_KEY;
 try{await assert.rejects(c.placement.accept(f.owner,randomUUID(),{reservationId:f.hold.id,quoteId:q.id,acceptPolicies:true,registration:{formId:form.id,answers:[{name:'One'},{name:'Two'},{name:'Three'}]}}),{code:'REGISTRATION_UNAVAILABLE'});}finally{process.env.REGISTRATION_ENCRYPTION_KEY=saved;}
 assert.equal((await pool.query('SELECT id FROM bookings.orders WHERE reservation_id=$1',[f.hold.id])).rowCount,0);
});
