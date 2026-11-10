export function dashboardMoney(value: string) {
  const n = BigInt(value);
  return `₹${(n / 100n).toLocaleString("en-IN")}.${(n % 100n).toString().padStart(2, "0")}`;
}
