// Isolated database fixtures only. Never import from production code.
import { commerce } from "../src/composition.ts";
import { Policies } from "../src/modules/pricing/application/policies.ts";
import { PostgresPolicies } from "../src/modules/pricing/adapters/policies.ts";
import { PostgresPolicyTarget } from "../src/modules/inventory/adapters/policy-target.ts";
import type { CommercialPolicy } from "../src/modules/pricing/domain/quote.ts";
import { randomUUID } from "node:crypto";
export const fixturePolicy: CommercialPolicy = {
  feePerOrderPaise: 0,
  feePerTicketPaise: 0,
  feeBasisPoints: 0,
  ticketTax: { basisPoints: 0, mode: "exclusive" },
  feeTax: { basisPoints: 0, mode: "exclusive" },
  cancellationTerms:
    "ISOLATED TEST POLICY: cancellation behavior is not enabled by this fixture.",
  admissionTerms:
    "ISOLATED TEST POLICY: one entry during the configured admission window.",
};
export const policies = new Policies(
  new PostgresPolicies(),
  new PostgresPolicyTarget(),
);
export async function assignFixturePolicy(
  ownerId: string,
  occurrenceId: string,
  configuration = fixturePolicy,
) {
  if (!process.env.DATABASE_URL?.includes("/bookmyticket_test"))
    throw new Error("Fixtures require isolated test database");
  const policy = (await policies.create(ownerId, {
    label: "ISOLATED TEST POLICY",
    configuration,
    reason: "Isolated test fixture configuration",
  })) as { id: string };
  const assignment = (await policies.assignment(occurrenceId)) as {
    version: number;
  } | null;
  await policies.assign(
    ownerId,
    occurrenceId,
    policy.id,
    assignment?.version ?? 0,
  );
  return policy.id;
}
export async function placeFixtureOrder(
  ownerId: string,
  reservationId: string,
  occurrenceId: string,
) {
  await assignFixturePolicy(ownerId, occurrenceId);
  const c = commerce();
  const quote = await c.quotes.create(ownerId, reservationId);
  return (await c.placement.accept(ownerId, randomUUID(), {
    reservationId,
    quoteId: quote.id,
    acceptPolicies: true,
  })) as { id: string; amount_paise: number };
}
