import { AppError } from "../../../shared/errors.ts";
export type Tax = { basisPoints: number; mode: "inclusive" | "exclusive" };
export type CommercialPolicy = {
  allowFreeBookings?: boolean;
  freeCancellationCutoffMinutes?: number;
  feePerOrderPaise: number;
  feePerTicketPaise: number;
  feeBasisPoints: number;
  ticketTax: Tax;
  feeTax: Tax;
  cancellationTerms: string;
  admissionTerms: string;
};
export type PriceInput = {
  occurrence_id: string;
  resource_id: string;
  quantity: number;
  unit_price_paise: number;
};
export type UnitPrice = {
  key: string;
  occurrenceId: string;
  resourceId: string;
  ordinal: number;
  ticketBasePaise: number;
  feeBasePaise: number;
  ticketTaxPaise: number;
  feeTaxPaise: number;
  totalPaise: number;
};
export type PriceBreakdown = {
  currency: "INR";
  units: UnitPrice[];
  ticketSubtotalPaise: number;
  feesPaise: number;
  taxesPaise: number;
  discountPaise: number;
  extrasPaise: number;
  totalPaise: number;
};
const MAX_AMOUNT = 1_000_000_000;
function integer(n: number, max = MAX_AMOUNT) {
  if (!Number.isSafeInteger(n) || n < 0 || n > max)
    throw new AppError(
      "INVALID_PRICING",
      "Prices and rates must be bounded non-negative integers.",
      422,
    );
}
function halfUp(n: bigint, d: bigint) {
  return Number((n + d / 2n) / d);
}
function taxSplit(amount: number, tax: Tax) {
  const value = halfUp(
    BigInt(amount) * BigInt(tax.basisPoints),
    BigInt(tax.mode === "inclusive" ? 10000 + tax.basisPoints : 10000),
  );
  return {
    base: tax.mode === "inclusive" ? amount - value : amount,
    tax: value,
  };
}
export function validatePolicy(p: CommercialPolicy) {
  if (p.freeCancellationCutoffMinutes !== undefined) {
    integer(p.freeCancellationCutoffMinutes, 525600);
    if (!p.allowFreeBookings)
      throw new AppError(
        "INVALID_PRICING",
        "Free cancellation requires free-booking authorization.",
        422,
      );
  }
  if (
    p.allowFreeBookings !== undefined &&
    typeof p.allowFreeBookings !== "boolean"
  )
    throw new AppError(
      "INVALID_PRICING",
      "Specify whether free bookings are authorized.",
      422,
    );
  integer(p.feePerOrderPaise);
  integer(p.feePerTicketPaise);
  integer(p.feeBasisPoints, 10000);
  for (const tax of [p.ticketTax, p.feeTax]) {
    integer(tax.basisPoints, 10000);
    if (!["inclusive", "exclusive"].includes(tax.mode))
      throw new AppError(
        "INVALID_PRICING",
        "Specify inclusive or exclusive tax treatment.",
        422,
      );
  }
  for (const terms of [p.cancellationTerms, p.admissionTerms])
    if (
      typeof terms !== "string" ||
      terms.trim().length < 10 ||
      terms.length > 10000
    )
      throw new AppError(
        "POLICY_TERMS_REQUIRED",
        "Explicit cancellation and admission terms are required.",
        422,
      );
}
// Proportional largest-remainder allocation; stable index order breaks equal remainders.
export function allocate(amount: number, weights: number[]): number[] {
  integer(amount);
  weights.forEach((w) => integer(w));
  if (!weights.length)
    throw new AppError("INVALID_PRICING", "No admission units to price.", 422);
  const effective = weights.some((w) => w > 0) ? weights : weights.map(() => 1),
    sum = effective.reduce((s, w) => s + BigInt(w), 0n);
  const parts = effective.map((w, i) => ({
    i,
    value: Number((BigInt(amount) * BigInt(w)) / sum),
    remainder: (BigInt(amount) * BigInt(w)) % sum,
  }));
  let left = amount - parts.reduce((s, p) => s + p.value, 0);
  for (const p of [...parts].sort((a, b) =>
    a.remainder === b.remainder
      ? a.i - b.i
      : a.remainder > b.remainder
        ? -1
        : 1,
  )) {
    if (left-- <= 0) break;
    p.value++;
  }
  return parts.map((p) => p.value);
}
export function calculate(
  items: PriceInput[],
  policy: CommercialPolicy,
): PriceBreakdown {
  validatePolicy(policy);
  if (!items.length)
    throw new AppError("INVALID_PRICING", "The reservation has no items.", 422);
  const units: {
    key: string;
    occurrenceId: string;
    resourceId: string;
    ordinal: number;
    price: number;
  }[] = [];
  for (const item of [...items].sort(
    (a, b) =>
      a.occurrence_id.localeCompare(b.occurrence_id) ||
      a.resource_id.localeCompare(b.resource_id),
  )) {
    integer(item.unit_price_paise);
    integer(item.quantity, 8);
    if (item.quantity === 0)
      throw new AppError("INVALID_PRICING", "Quantity must be positive.", 422);
    for (let n = 0; n < item.quantity; n++)
      units.push({
        key: `${item.occurrence_id}:${item.resource_id}:${n}`,
        occurrenceId: item.occurrence_id,
        resourceId: item.resource_id,
        ordinal: n,
        price: item.unit_price_paise,
      });
  }
  if (
    units.length > 8 ||
    new Set(units.map((u) => u.key)).size !== units.length
  )
    throw new AppError(
      "INVALID_PRICING",
      "Invalid admission unit selection.",
      422,
    );
  const subtotal = units.reduce((s, u) => s + u.price, 0);
  integer(subtotal);
  const fee =
    policy.feePerOrderPaise +
    policy.feePerTicketPaise * units.length +
    halfUp(BigInt(subtotal) * BigInt(policy.feeBasisPoints), 10000n);
  integer(fee);
  const fees = allocate(
    fee,
    units.map((u) => u.price),
  );
  const priced = units.map((u, i) => {
    const ticket = taxSplit(u.price, policy.ticketTax),
      fee = taxSplit(fees[i], policy.feeTax);
    return {
      key: u.key,
      occurrenceId: u.occurrenceId,
      resourceId: u.resourceId,
      ordinal: u.ordinal,
      ticketBasePaise: ticket.base,
      feeBasePaise: fee.base,
      ticketTaxPaise: ticket.tax,
      feeTaxPaise: fee.tax,
      totalPaise: ticket.base + ticket.tax + fee.base + fee.tax,
    };
  });
  const result: PriceBreakdown = {
    currency: "INR",
    units: priced,
    ticketSubtotalPaise: priced.reduce((n, u) => n + u.ticketBasePaise, 0),
    feesPaise: priced.reduce((n, u) => n + u.feeBasePaise, 0),
    taxesPaise: priced.reduce(
      (n, u) => n + u.ticketTaxPaise + u.feeTaxPaise,
      0,
    ),
    extrasPaise: 0,
    discountPaise: 0,
    totalPaise: priced.reduce((n, u) => n + u.totalPaise, 0),
  };
  integer(result.totalPaise);
  if (result.totalPaise === 0 && policy.allowFreeBookings !== true)
    throw new AppError(
      "FREE_BOOKING_NOT_ALLOWED",
      "This commercial policy does not authorize free bookings.",
      409,
    );
  return result;
}
