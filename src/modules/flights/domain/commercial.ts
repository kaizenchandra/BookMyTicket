export type CommercialRule = {
  version: number;
  markup_bps: number;
  service_fee_paise: string;
};
/** Platform markup applies only to supplier base fare; taxes are passed through. Round half up to a paise. */
export function pricePreview(
  basePaise: string,
  taxPaise: string,
  rule: CommercialRule,
) {
  const base = BigInt(basePaise),
    tax = BigInt(taxPaise),
    fee = BigInt(rule.service_fee_paise);
  if (
    base < 0n ||
    tax < 0n ||
    fee < 0n ||
    !Number.isInteger(rule.markup_bps) ||
    rule.markup_bps < 0 ||
    rule.markup_bps > 10000
  )
    throw new Error("Invalid commercial amounts");
  const markup = (base * BigInt(rule.markup_bps) + 5000n) / 10000n;
  return {
    currency: "INR" as const,
    basePaise: base.toString(),
    taxPaise: tax.toString(),
    markupPaise: markup.toString(),
    serviceFeePaise: fee.toString(),
    totalPaise: (base + tax + markup + fee).toString(),
    ruleVersion: rule.version,
    bookable: false as const,
  };
}
