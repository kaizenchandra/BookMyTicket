// Persist technical codes only. Do not retain provider email/card/VPA or free-text error descriptions.
export function paymentMetadata(p: {
  method?: unknown;
  error_code?: unknown;
  error_reason?: unknown;
  amount_refunded?: unknown;
  amount: number;
}) {
  const code = (v: unknown) =>
    typeof v === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/.test(v) ? v : null;
  const method =
    typeof p.method === "string" &&
    [
      "card",
      "upi",
      "netbanking",
      "wallet",
      "emi",
      "bank_transfer",
      "paylater",
    ].includes(p.method)
      ? p.method
      : null;
  return {
    method,
    errorCode: code(p.error_code),
    errorReason: code(p.error_reason),
    refunded:
      Number.isSafeInteger(p.amount_refunded) &&
      Number(p.amount_refunded) >= 0 &&
      Number(p.amount_refunded) <= p.amount
        ? String(p.amount_refunded)
        : null,
  };
}
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
