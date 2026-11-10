export type Kind = "operators" | "routes" | "services";
export type Operator = {
  name: string;
  contactEmail: string;
  contactPhone: string;
  supplierName: string;
  supplierReference: string;
  active: boolean;
};
export type Stop = { name: string; address: string; offsetMinutes: number };
export type Route = {
  name: string;
  origin: string;
  destination: string;
  boarding: Stop[];
  dropping: Stop[];
  active: boolean;
};
export type Seat = {
  label: string;
  deck: "lower" | "upper";
  row: number;
  column: number;
  type: "seater" | "sleeper";
  farePaise: string;
};
export type Service = {
  name: string;
  operatorId: string;
  routeId: string;
  departure: string;
  arrival: string;
  amenities: string[];
  seats: Seat[];
  cancellationPolicy: string;
  freeCancellationHours: number;
  penaltyBps: number;
  routeSnapshot?: Route;
};
export type Content = Operator | Route | Service;
export function layoutErrors(s: Service) {
  const errors: string[] = [];
  if (
    new Set(s.seats.map((x) => x.label.toLowerCase())).size !== s.seats.length
  )
    errors.push("Seat labels must be unique.");
  if (
    new Set(s.seats.map((x) => [x.deck, x.row, x.column].join(":"))).size !==
    s.seats.length
  )
    errors.push("Seats cannot occupy the same grid position.");
  if (Date.parse(s.arrival) <= Date.parse(s.departure))
    errors.push("Arrival must follow departure.");
  return errors;
}
export function routeErrors(r: Route) {
  const errors: string[] = [];
  if (r.origin.toLowerCase() === r.destination.toLowerCase())
    errors.push("Origin and destination must differ.");
  for (const list of [r.boarding, r.dropping])
    if (
      list.some((s, i) => i > 0 && s.offsetMinutes < list[i - 1].offsetMinutes)
    )
      errors.push("Stops must be ordered by time offset.");
  if (r.boarding.at(-1)!.offsetMinutes >= r.dropping[0].offsetMinutes)
    errors.push("Drop-off points must follow boarding points.");
  return errors;
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
