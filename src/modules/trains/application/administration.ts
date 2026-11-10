import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  serviceErrors,
  routeErrors,
  incidentTransition,
  type Kind,
  type Content,
  type Service,
  type Route,
  type Station,
} from "../domain/catalogue.ts";
export type TrainRecord = {
  id: string;
  kind: Kind;
  code: string;
  content: Content;
  status: string;
  version: number;
  created_at: Date;
};
export type Filters = {
  q?: string;
  status?: string;
  trainNumber?: string;
  routeId?: string;
  from?: string;
  until?: string;
  after?: string;
};
export interface TrainStore {
  run<T>(
    actor: string,
    write: boolean,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
  once<T>(
    tx: Transaction,
    actor: string,
    op: string,
    key: string,
    input: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  list(
    tx: Transaction,
    actor: string,
    kind: Kind,
    f: Filters,
  ): Promise<{ items: TrainRecord[]; nextCursor: string | null }>;
  get(
    tx: Transaction,
    kind: Kind,
    id: string,
    write?: boolean,
  ): Promise<TrainRecord>;
  create(
    tx: Transaction,
    kind: Kind,
    code: string,
    content: Content,
    status: string,
  ): Promise<string>;
  update(
    tx: Transaction,
    id: string,
    content: Content,
    status: string,
  ): Promise<void>;
  record(
    tx: Transaction,
    actor: string,
    action: string,
    reason: string,
    before: TrainRecord | null,
    after: TrainRecord,
  ): Promise<void>;
  history(tx: Transaction, id: string, before?: string): Promise<unknown>;
}
export class TrainAdministration {
  constructor(
    private store: TrainStore,
    private audit: SecurityAudit,
  ) {}
  list(actor: string, kind: Kind, f: Filters) {
    return this.store.run(actor, false, async (tx) => {
      if (
        kind !== "services" &&
        (f.trainNumber || f.routeId || f.from || f.until)
      )
        throw new AppError(
          "INVALID_FILTER",
          "Schedule filters apply only to services.",
          422,
        );
      const result = await this.store.list(tx, actor, kind, f);
      await this.audit.record(tx, actor, "trains.catalogue.read", kind, {
        count: result.items.length,
      });
      return result;
    });
  }
  detail(actor: string, kind: Kind, id: string) {
    return this.store.run(actor, false, async (tx) => {
      const record = await this.store.get(tx, kind, id);
      await this.audit.record(tx, actor, "trains.record.read", id, {});
      return {
        record,
        integration: {
          state: "not_configured",
          availability: null,
          bookable: false,
          fare: null,
          pnr: null,
          waitlistStatus: null,
          cancellationStatus: null,
          refundStatus: null,
          bookingStatus: null,

          message:
            "No authorized railway provider is connected. Timetables and travel classes are local reference data; availability, PNRs and refunds are not supplier-verified.",
        },
      };
    });
  }
  create(
    actor: string,
    kind: Kind,
    key: string,
    input: { code: string; content: Content; reason: string },
  ) {
    return this.store.run(actor, true, (tx) =>
      this.store.once(tx, actor, "create:" + kind, key, input, async () => {
        const content = await this.validate(tx, kind, input.content),
          status =
            kind === "services"
              ? "planned"
              : (content as Station | Route).active
                ? "active"
                : "suspended",
          id = await this.store.create(tx, kind, input.code, content, status),
          after = await this.store.get(tx, kind, id);
        await this.record(tx, actor, "created", input.reason, null, after);
        return { id };
      }),
    );
  }
  edit(
    actor: string,
    kind: Kind,
    id: string,
    input: { content: Content; expectedVersion: number; reason: string },
  ) {
    return this.store.run(actor, true, async (tx) => {
      const before = await this.store.get(tx, kind, id, true);
      this.version(before, input.expectedVersion);
      if (
        kind === "stations" &&
        (before.content as Station).stationCode !==
          (input.content as Station).stationCode
      )
        throw new AppError(
          "IMMUTABLE_STATION_CODE",
          "Station codes cannot be changed; create a distinct station record.",
        );
      if (before.status === "withdrawn")
        throw new AppError(
          "STATE_CONFLICT",
          "Withdrawn services are retained as history and cannot be edited.",
        );
      const content = await this.validate(tx, kind, input.content),
        status =
          kind === "services"
            ? before.status
            : (content as Station | Route).active
              ? "active"
              : "suspended";
      await this.store.update(tx, id, content, status);
      const after = await this.store.get(tx, kind, id);
      await this.record(tx, actor, "edited", input.reason, before, after);
      return after;
    });
  }
  incident(
    actor: string,
    id: string,
    input: {
      action: "disrupt" | "resolve" | "withdraw";
      expectedVersion: number;
      reason: string;
    },
  ) {
    return this.store.run(actor, true, async (tx) => {
      const before = await this.store.get(tx, "services", id, true);
      this.version(before, input.expectedVersion);
      const status = incidentTransition(before.status, input.action);
      if (!status)
        throw new AppError(
          "STATE_CONFLICT",
          "This disruption action is not valid for the current service state.",
        );
      await this.store.update(tx, id, before.content, status);
      const after = await this.store.get(tx, "services", id);
      await this.record(tx, actor, input.action, input.reason, before, after);
      return after;
    });
  }
  history(actor: string, kind: Kind, id: string, before?: string) {
    return this.store.run(actor, false, async (tx) => {
      await this.store.get(tx, kind, id);
      const result = await this.store.history(tx, id, before);
      await this.audit.record(tx, actor, "trains.history.read", id, {});
      return result;
    });
  }
  private version(r: TrainRecord, v: number) {
    if (r.version !== v)
      throw new AppError(
        "STALE_VERSION",
        "Catalogue record changed. Reload before saving.",
      );
  }
  private async normalizedRoute(tx: Transaction, route: Route): Promise<Route> {
    const errors = routeErrors(route);
    if (errors.length)
      throw new AppError("INVALID_ROUTE", errors.join(" "), 422);
    const stations = new Map<string, TrainRecord>();
    for (const id of [
      ...new Set(route.stops.map((s) => s.stationId.toLowerCase())),
    ].sort()) {
      const station = await this.store.get(tx, "stations", id);
      if (station.status !== "active")
        throw new AppError(
          "INACTIVE_REFERENCE",
          "Route stations must be active.",
        );
      stations.set(id, station);
    }
    return {
      ...route,
      stops: route.stops.map((s) => {
        const row = stations.get(s.stationId.toLowerCase())!,
          station = row.content as Station;
        return {
          ...s,
          stationId: row.id,
          station: {
            name: station.name,
            code: station.stationCode,
            city: station.city,
          },
        };
      }),
    };
  }
  private async validate(
    tx: Transaction,
    kind: Kind,
    c: Content,
  ): Promise<Content> {
    if (kind === "stations") return c;
    if (kind === "routes") return this.normalizedRoute(tx, c as Route);
    const service = c as Service,
      errors = serviceErrors(service);
    if (errors.length)
      throw new AppError("INVALID_SCHEDULE", errors.join(" "), 422);
    const record = await this.store.get(tx, "routes", service.routeId);
    if (record.status !== "active")
      throw new AppError("INACTIVE_REFERENCE", "Choose an active route.");
    const route = await this.normalizedRoute(tx, record.content as Route);
    if (
      Date.parse(service.arrival) - Date.parse(service.departure) !==
      route.stops.at(-1)!.arrivalMinutes * 60000
    )
      throw new AppError(
        "INVALID_SCHEDULE",
        "Service arrival must match the final route arrival offset.",
        422,
      );
    return { ...service, routeId: record.id, routeSnapshot: route };
  }
  private async record(
    tx: Transaction,
    actor: string,
    action: string,
    reason: string,
    before: TrainRecord | null,
    after: TrainRecord,
  ) {
    await this.store.record(tx, actor, action, reason, before, after);
    await this.audit.record(tx, actor, "trains." + action, after.id, {
      kind: after.kind,
      reason,
      before: before
        ? { version: before.version, status: before.status }
        : null,
      after: { version: after.version, status: after.status },
    });
  }
}
