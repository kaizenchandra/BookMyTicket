import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  layoutErrors,
  routeErrors,
  disruptionTransition,
  type Kind,
  type Content,
  type Service,
  type Route,
  type Operator,
} from "../domain/catalogue.ts";
export type BusRecord = {
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
  operatorId?: string;
  routeId?: string;
  from?: string;
  until?: string;
  after?: string;
};
export interface BusStore {
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
  ): Promise<{ items: BusRecord[]; nextCursor: string | null }>;
  get(
    tx: Transaction,
    kind: Kind,
    id: string,
    write?: boolean,
  ): Promise<BusRecord>;
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
    before: BusRecord | null,
    after: BusRecord,
  ): Promise<void>;
  history(tx: Transaction, id: string, before?: string): Promise<unknown>;
}
export class BusAdministration {
  constructor(
    private store: BusStore,
    private audit: SecurityAudit,
  ) {}
  list(actor: string, kind: Kind, f: Filters) {
    return this.store.run(actor, false, async (tx) => {
      if (
        kind !== "services" &&
        (f.operatorId || f.routeId || f.from || f.until)
      )
        throw new AppError(
          "INVALID_FILTER",
          "Schedule filters apply only to services.",
          422,
        );
      const result = await this.store.list(tx, actor, kind, f);
      await this.audit.record(tx, actor, "buses.catalogue.read", kind, {
        count: result.items.length,
      });
      return result;
    });
  }
  detail(actor: string, kind: Kind, id: string) {
    return this.store.run(actor, false, async (tx) => {
      const record = await this.store.get(tx, kind, id);
      await this.audit.record(tx, actor, "buses.record.read", id, {});
      return {
        record,
        integration: {
          state: "not_configured",
          availability: null,
          bookedSeats: null,
          bookingStatus: null,
          ticketStatus: null,
          message:
            "No authorized bus supplier is connected. Catalogue fares/layouts are operator-entered references, not live availability or confirmed tickets.",
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
              : (content as Operator | Route).active
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
      if (before.status === "withdrawn")
        throw new AppError(
          "STATE_CONFLICT",
          "Withdrawn services are retained as history and cannot be edited.",
        );
      const content = await this.validate(tx, kind, input.content),
        status =
          kind === "services"
            ? before.status
            : (content as Operator | Route).active
              ? "active"
              : "suspended";
      await this.store.update(tx, id, content, status);
      const after = await this.store.get(tx, kind, id);
      await this.record(tx, actor, "edited", input.reason, before, after);
      return after;
    });
  }
  disruption(
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
      const status = disruptionTransition(before.status, input.action);
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
      await this.audit.record(tx, actor, "buses.history.read", id, {});
      return result;
    });
  }
  private version(r: BusRecord, v: number) {
    if (r.version !== v)
      throw new AppError(
        "STALE_VERSION",
        "Catalogue record changed. Reload before saving.",
      );
  }
  private async validate(
    tx: Transaction,
    kind: Kind,
    c: Content,
  ): Promise<Content> {
    if (kind === "operators") return c;
    if (kind === "routes") {
      const errors = routeErrors(c as Route);
      if (errors.length)
        throw new AppError("INVALID_ROUTE", errors.join(" "), 422);
      return c;
    }
    const s = c as Service,
      errors = layoutErrors(s);
    if (errors.length)
      throw new AppError("INVALID_LAYOUT", errors.join(" "), 422);
    const operator = await this.store.get(tx, "operators", s.operatorId),
      route = await this.store.get(tx, "routes", s.routeId);
    if (operator.status !== "active" || route.status !== "active")
      throw new AppError(
        "INACTIVE_REFERENCE",
        "Choose an active operator and route.",
      );
    const routeContent = route.content as Route,
      duration = (Date.parse(s.arrival) - Date.parse(s.departure)) / 60000;
    if (routeContent.dropping.at(-1)!.offsetMinutes > duration)
      throw new AppError(
        "INVALID_SCHEDULE",
        "Last drop-off offset exceeds service duration.",
        422,
      );
    return {
      ...s,
      operatorId: operator.id,
      routeId: route.id,
      routeSnapshot: routeContent,
    };
  }
  private async record(
    tx: Transaction,
    actor: string,
    action: string,
    reason: string,
    before: BusRecord | null,
    after: BusRecord,
  ) {
    await this.store.record(tx, actor, action, reason, before, after);
    await this.audit.record(tx, actor, "buses." + action, after.id, {
      kind: after.kind,
      reason,
      before: before
        ? { version: before.version, status: before.status }
        : null,
      after: { version: after.version, status: after.status },
    });
  }
}
