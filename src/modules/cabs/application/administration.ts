import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  serviceErrors,
  quoteErrors,
  calculateFare,
  type QuoteInput,
  disruptionTransition,
  type Kind,
  type Content,
  type Service,
  type Category,
  type Supplier,
} from "../domain/catalogue.ts";
export type CabRecord = {
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
  supplierId?: string;
  categoryId?: string;
  from?: string;
  until?: string;
  after?: string;
};
export interface CabStore {
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
  ): Promise<{ items: CabRecord[]; nextCursor: string | null }>;
  get(
    tx: Transaction,
    kind: Kind,
    id: string,
    write?: boolean,
  ): Promise<CabRecord>;
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
    before: CabRecord | null,
    after: CabRecord,
  ): Promise<void>;
  history(tx: Transaction, id: string, before?: string): Promise<unknown>;
}
export class CabAdministration {
  constructor(
    private store: CabStore,
    private audit: SecurityAudit,
  ) {}
  list(actor: string, kind: Kind, f: Filters) {
    return this.store.run(actor, false, async (tx) => {
      if (
        kind !== "services" &&
        (f.supplierId || f.categoryId || f.from || f.until)
      )
        throw new AppError(
          "INVALID_FILTER",
          "Schedule filters apply only to services.",
          422,
        );
      const result = await this.store.list(tx, actor, kind, f);
      await this.audit.record(tx, actor, "cabs.catalogue.read", kind, {
        count: result.items.length,
      });
      return result;
    });
  }
  detail(actor: string, kind: Kind, id: string) {
    return this.store.run(actor, false, async (tx) => {
      const record = await this.store.get(tx, kind, id);
      await this.audit.record(tx, actor, "cabs.record.read", id, {});
      return {
        record,
        integration: {
          state: "not_configured",
          availability: null,
          reservations: null,
          bookingStatus: null,
          tripStatus: null,
          cancellationStatus: null,
          actualCharges: null,
          reconciliation: null,
          bookable: false,
          message:
            "No authorized cab supplier is connected. Configured coverage and fare estimates do not confirm vehicle availability or reservations.",
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
              : (content as Supplier | Category).active
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
            : (content as Supplier | Category).active
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
      await this.audit.record(tx, actor, "cabs.history.read", id, {});
      return result;
    });
  }
  private version(r: CabRecord, v: number) {
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
    if (kind !== "services") return c;
    const s = c as Service,
      errors = serviceErrors(s);
    if (errors.length)
      throw new AppError("INVALID_SERVICE", errors.join(" "), 422);
    const supplier = await this.store.get(tx, "suppliers", s.supplierId),
      category = await this.store.get(tx, "categories", s.categoryId);
    if (supplier.status !== "active" || category.status !== "active")
      throw new AppError(
        "INACTIVE_REFERENCE",
        "Select an active supplier and vehicle category.",
      );
    return { ...s, supplierId: supplier.id, categoryId: category.id };
  }
  preview(actor: string, id: string, input: QuoteInput) {
    return this.store.run(actor, false, async (tx) => {
      const record = await this.store.get(tx, "services", id);
      this.version(record, input.expectedVersion);
      if (record.status !== "planned")
        throw new AppError(
          "STATE_CONFLICT",
          "Service is disrupted or withdrawn.",
        );
      const s = (await this.validate(
        tx,
        "services",
        record.content,
      )) as Service;
      const category = await this.store.get(tx, "categories", s.categoryId);
      const errors = quoteErrors(s, category.content as Category, input);
      if (errors.length)
        throw new AppError("OUTSIDE_COVERAGE", errors.join(" "), 422);
      const result = {
        ...calculateFare(s, input),
        serviceId: id,
        serviceVersion: record.version,
        categoryVersion: category.version,
      };
      await this.audit.record(tx, actor, "cabs.fare.preview", id, {
        version: record.version,
        totalPaise: result.totalPaise,
      });
      return result;
    });
  }

  private async record(
    tx: Transaction,
    actor: string,
    action: string,
    reason: string,
    before: CabRecord | null,
    after: CabRecord,
  ) {
    await this.store.record(tx, actor, action, reason, before, after);
    await this.audit.record(tx, actor, "cabs." + action, after.id, {
      kind: after.kind,
      reason,
      before: before
        ? { version: before.version, status: before.status }
        : null,
      after: { version: after.version, status: after.status },
    });
  }
}
