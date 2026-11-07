import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocate,
  calculate,
  validatePolicy,
  type CommercialPolicy,
} from "../src/modules/pricing/domain/quote.ts";
const policy: CommercialPolicy = {
  feePerOrderPaise: 0,
  feePerTicketPaise: 0,
  feeBasisPoints: 0,
  ticketTax: { basisPoints: 0, mode: "exclusive" },
  feeTax: { basisPoints: 0, mode: "exclusive" },
  cancellationTerms: "TEST POLICY: no cancellation rules are inferred.",
  admissionTerms: "TEST POLICY: admission rules are explicit.",
};
const item = (price: number, quantity = 1) => [
  {
    occurrence_id: "occurrence",
    resource_id: "A1",
    quantity,
    unit_price_paise: price,
  },
];
test("BE:PRC-02/05 — exact half-up rounding and inclusive/exclusive tax treatment", () => {
  const inclusive = calculate(item(11800), {
    ...policy,
    feePerOrderPaise: 118,
    ticketTax: { basisPoints: 1800, mode: "inclusive" },
    feeTax: { basisPoints: 1800, mode: "inclusive" },
  });
  assert.equal(inclusive.ticketSubtotalPaise, 10000);
  assert.equal(inclusive.feesPaise, 100);
  assert.equal(inclusive.taxesPaise, 1818);
  assert.equal(inclusive.totalPaise, 11918);
  const exclusive = calculate(item(1), {
    ...policy,
    ticketTax: { basisPoints: 5000, mode: "exclusive" },
  });
  assert.equal(exclusive.taxesPaise, 1);
  assert.equal(exclusive.totalPaise, 2);
});
test("BE:PRC-12 — largest remainder allocations conserve every paise deterministically", () => {
  assert.deepEqual(allocate(5, [101, 101, 101]), [2, 2, 1]);
  assert.deepEqual(allocate(2, [0, 0, 0]), [1, 1, 0]);
  for (let amount = 0; amount < 100; amount++) {
    const allocation = allocate(amount, [1, 7, 23, 0]);
    assert.equal(
      allocation.reduce((n, v) => n + v, 0),
      amount,
    );
    assert.equal(allocation[3], 0);
  }
  const result = calculate(item(101, 3), { ...policy, feePerOrderPaise: 5 });
  assert.deepEqual(
    result.units.map((u) => u.feeBasePaise),
    [2, 2, 1],
  );
  assert.equal(result.totalPaise, 308);
});
test("BE:PRC-02 — rejects unsafe values and no implicit commercial terms", () => {
  assert.throws(() => calculate(item(1.2), policy), {
    code: "INVALID_PRICING",
  });
  assert.throws(() => calculate(item(Number.MAX_SAFE_INTEGER), policy), {
    code: "INVALID_PRICING",
  });
  assert.throws(() => calculate(item(100, 9), policy), {
    code: "INVALID_PRICING",
  });
  assert.throws(() => validatePolicy({ ...policy, cancellationTerms: "" }), {
    code: "POLICY_TERMS_REQUIRED",
  });
  assert.throws(() => calculate([...item(100), ...item(100)], policy), {
    code: "INVALID_PRICING",
  });
});
test("BE:PRC-05 — allocation independent of input ordering", () => {
  const items = [
    { occurrence_id: "o", resource_id: "B", quantity: 1, unit_price_paise: 51 },
    { occurrence_id: "o", resource_id: "A", quantity: 1, unit_price_paise: 51 },
  ];
  assert.deepEqual(
    calculate(items, { ...policy, feePerOrderPaise: 1 }),
    calculate([...items].reverse(), { ...policy, feePerOrderPaise: 1 }),
  );
});
