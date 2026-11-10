export type Kind = "suppliers" | "categories" | "services";
export type Supplier = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  supplierReference: string;
  active: boolean;
};
export type Category = {
  name: string;
  passengers: number;
  luggage: number;
  amenities: string;
  active: boolean;
};
export type Service = {
  name: string;
  supplierId: string;
  categoryId: string;
  mode: "city" | "airport" | "outstation";
  origin: string;
  destination: string;
  availableFrom: string;
  availableUntil: string;
  maxDistanceMeters: number;
  basePaise: string;
  includedMeters: number;
  perKmPaise: string;
  includedWaitingMinutes: number;
  waitingMinutePaise: string;
  driverAllowancePaise: string;
  airportFeePaise: string;
  cancellationPolicy: string;
};
export type Content = Supplier | Category | Service;
export type QuoteInput = {
  expectedVersion: number;
  pickupAt: string;
  origin: string;
  destination: string;
  passengers: number;
  luggage: number;
  distanceMeters: number;
  durationMinutes: number;
  waitingMinutes: number;
};
export function serviceErrors(s: Service) {
  const errors: string[] = [];
  if (Date.parse(s.availableUntil) <= Date.parse(s.availableFrom))
    errors.push("Coverage end must follow start.");
  if (s.includedMeters > s.maxDistanceMeters)
    errors.push("Included distance cannot exceed the maximum trip distance.");
  if (
    s.mode === "city" &&
    s.origin.toLowerCase() !== s.destination.toLowerCase()
  )
    errors.push("City service must start and end in the same city.");
  if (
    s.mode !== "city" &&
    s.origin.toLowerCase() === s.destination.toLowerCase()
  )
    errors.push("Transfer/outstation endpoints must differ.");
  if (s.mode !== "airport" && BigInt(s.airportFeePaise) !== 0n)
    errors.push("Airport fee applies only to airport transfers.");
  return errors;
}
export function quoteErrors(s: Service, c: Category, q: QuoteInput) {
  const end = Date.parse(q.pickupAt) + q.durationMinutes * 60000;
  return [
    q.waitingMinutes > q.durationMinutes
      ? "Waiting cannot exceed total trip duration."
      : "",
    q.origin.trim().toLowerCase() !== s.origin.toLowerCase() ||
    q.destination.trim().toLowerCase() !== s.destination.toLowerCase()
      ? "Trip endpoints are outside this directional service area."
      : "",
    Date.parse(q.pickupAt) < Date.parse(s.availableFrom) ||
    end > Date.parse(s.availableUntil)
      ? "The full trip must fit the configured coverage window."
      : "",
    q.passengers > c.passengers || q.luggage > c.luggage
      ? "Party or luggage exceeds vehicle category limits."
      : "",
    q.distanceMeters > s.maxDistanceMeters
      ? "Trip distance exceeds the service limit."
      : "",
  ].filter(Boolean);
}
export function calculateFare(s: Service, q: QuoteInput) {
  const chargeableMeters = Math.max(0, q.distanceMeters - s.includedMeters);
  // Round the aggregate distance charge up to the next paise, not each kilometre.
  const distance =
    (BigInt(chargeableMeters) * BigInt(s.perKmPaise) + 999n) / 1000n;
  const waiting =
    BigInt(Math.max(0, q.waitingMinutes - s.includedWaitingMinutes)) *
    BigInt(s.waitingMinutePaise);
  const lines = [
    { label: "Base fare", paise: s.basePaise },
    { label: "Extra distance", paise: String(distance) },
    { label: "Waiting", paise: String(waiting) },
    { label: "Driver allowance per trip", paise: s.driverAllowancePaise },
    { label: "Airport fee per trip", paise: s.airportFeePaise },
  ];
  return {
    currency: "INR" as const,
    lines,
    totalPaise: String(lines.reduce((sum, l) => sum + BigInt(l.paise), 0n)),
    chargeableMeters,
    distanceMeters: q.distanceMeters,
    durationMinutes: q.durationMinutes,
    waitingMinutes: q.waitingMinutes,
    bookable: false as const,
    availability: null,
    exclusions: ["Taxes", "Tolls", "Parking"],
    basis:
      "Configured tariff estimate; distances and duration supplied by administrator. Not a supplier quote or confirmed reservation.",
  };
}
export function disruptionTransition(
  status: string,
  action: "disrupt" | "resolve" | "withdraw",
) {
  if (action === "disrupt" && status === "planned") return "disrupted";
  if (action === "resolve" && status === "disrupted") return "planned";
  if (action === "withdraw" && ["planned", "disrupted"].includes(status))
    return "withdrawn";
  return null;
}
