export function stayDates(from: string, until: string) {
  const dates: string[] = [];
  for (
    let n = Date.parse(from + "T00:00:00Z");
    n < Date.parse(until + "T00:00:00Z");
    n += 86400000
  )
    dates.push(new Date(n).toISOString().slice(0, 10));
  return dates;
}
export function roomNight(
  base: string,
  extra: string,
  included: number,
  guests: number,
  discount: number,
  quantity: number,
) {
  const gross =
    BigInt(base) + BigInt(Math.max(0, guests - included)) * BigInt(extra);
  return (
    ((gross * BigInt(10000 - discount) + 5000n) / 10000n) *
    BigInt(quantity)
  ).toString();
}
