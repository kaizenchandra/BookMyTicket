export type Kind = "stations" | "routes" | "services";
export type Station = {
  name: string;
  stationCode: string;
  city: string;
  active: boolean;
};
export type Stop = {
  stationId: string;
  arrivalMinutes: number;
  departureMinutes: number;
  boarding: boolean;
  alighting: boolean;
  station?: { name: string; code: string; city: string };
};
export type Route = { name: string; stops: Stop[]; active: boolean };
export type Service = {
  name: string;
  trainNumber: string;
  routeId: string;
  departure: string;
  arrival: string;
  classes: { code: string; name: string }[];
  providerReference: string;
  operationalNotes: string;
  routeSnapshot?: Route;
};
export type Content = Station | Route | Service;
export function routeErrors(r: Route) {
  const errors: string[] = [];
  if (r.stops[0].arrivalMinutes !== 0 || r.stops[0].departureMinutes !== 0)
    errors.push("The first station starts at offset zero.");
  if (r.stops.some((s) => s.departureMinutes < s.arrivalMinutes))
    errors.push("Station departure cannot precede arrival.");
  if (
    r.stops.some(
      (s, i) =>
        i > 0 &&
        (s.arrivalMinutes <= r.stops[i - 1].departureMinutes ||
          s.stationId.toLowerCase() === r.stops[i - 1].stationId.toLowerCase()),
    )
  )
    errors.push(
      "Successive stops must be different stations with increasing times.",
    );
  if (!r.stops[0].boarding || !r.stops.at(-1)!.alighting)
    errors.push(
      "The first stop must allow boarding and the last must allow alighting.",
    );
  return errors;
}
export function serviceErrors(s: Service) {
  const errors: string[] = [];
  if (Date.parse(s.arrival) <= Date.parse(s.departure))
    errors.push("Arrival must follow departure.");
  if (
    new Set(s.classes.map((c) => c.code.toUpperCase())).size !==
    s.classes.length
  )
    errors.push("Travel class codes must be unique.");
  return errors;
}
export function incidentTransition(
  status: string,
  action: "disrupt" | "resolve" | "withdraw",
) {
  if (action === "disrupt" && status === "planned") return "disrupted";
  if (action === "resolve" && status === "disrupted") return "planned";
  if (action === "withdraw" && ["planned", "disrupted"].includes(status))
    return "withdrawn";
  return null;
}
