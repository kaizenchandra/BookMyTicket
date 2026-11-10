import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import { pricePreview, type CommercialRule } from "../domain/commercial.ts";
export type SupplierInput = {
  code: string;
  name: string;
  airlineCodes: string[];
  environment: "sandbox" | "production";
  reason: string;
};
export type Supplier = {
  id: string;
  code: string;
  name: string;
  airlineCodes: string[];
  environment: string;
  status: string;
  version: number;
  created_at: Date;
};
export type Filters = {
  q?: string;
  status?: "draft" | "suspended";
  after?: string;
};
export interface FlightStore {
  run<T>(
    actor: string,
    permission: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
  once<T>(
    tx: Transaction,
    actor: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  list(
    tx: Transaction,
    actor: string,
    f: Filters,
  ): Promise<{ items: Supplier[]; nextCursor: string | null }>;
  get(tx: Transaction, id: string): Promise<Supplier>;
  create(tx: Transaction, input: SupplierInput): Promise<string>;
  update(
    tx: Transaction,
    id: string,
    input: SupplierInput & { status: "draft" | "suspended" },
  ): Promise<void>;
  rule(tx: Transaction, id: string): Promise<CommercialRule | null>;
  saveRule(
    tx: Transaction,
    id: string,
    bps: number,
    fee: string,
  ): Promise<void>;
}
export class FlightAdministration {
  constructor(
    private store: FlightStore,
    private audit: SecurityAudit,
  ) {}
  list(actor: string, f: Filters) {
    return this.store.run(actor, "flights.read", async (tx) => {
      const result = await this.store.list(tx, actor, f);
      await this.audit.record(
        tx,
        actor,
        "flights.suppliers.read",
        "directory",
        { count: result.items.length },
      );
      return result;
    });
  }
  detail(actor: string, id: string) {
    return this.store.run(actor, "flights.read", async (tx) => {
      const supplier = await this.store.get(tx, id),
        rule = await this.store.rule(tx, id);
      await this.audit.record(tx, actor, "flights.supplier.read", id, {});
      return {
        supplier,
        rule,
        integration: {
          state: "not_configured",
          message:
            "An authorized supplier adapter and credentials are required. No live availability, reservation, ticketing or synchronization is configured.",
        },
      };
    });
  }
  create(actor: string, key: string, input: SupplierInput) {
    return this.store.run(actor, "flights.manage", (tx) =>
      this.store.once(tx, actor, key, input, async () => {
        const id = await this.store.create(tx, input);
        await this.audit.record(tx, actor, "flights.supplier.created", id, {
          reason: input.reason,
          after: await this.store.get(tx, id),
        });
        return { id };
      }),
    );
  }
  update(
    actor: string,
    id: string,
    input: SupplierInput & {
      expectedVersion: number;
      status: "draft" | "suspended";
    },
  ) {
    return this.store.run(actor, "flights.manage", async (tx) => {
      const before = await this.store.get(tx, id);
      if (before.version !== input.expectedVersion)
        throw new AppError(
          "STALE_VERSION",
          "Supplier changed. Reload before saving.",
        );
      await this.store.update(tx, id, input);
      const after = await this.store.get(tx, id);
      await this.audit.record(tx, actor, "flights.supplier.changed", id, {
        reason: input.reason,
        before,
        after,
      });
      return after;
    });
  }
  saveRule(
    actor: string,
    id: string,
    input: {
      expectedVersion: number;
      markupBps: number;
      serviceFeePaise: string;
      reason: string;
    },
  ) {
    return this.store.run(actor, "pricing", async (tx) => {
      await this.store.get(tx, id);
      const before = await this.store.rule(tx, id);
      if ((before?.version ?? 0) !== input.expectedVersion)
        throw new AppError(
          "STALE_VERSION",
          "Commercial rule changed. Reload before saving.",
        );
      await this.store.saveRule(tx, id, input.markupBps, input.serviceFeePaise);
      const after = await this.store.rule(tx, id);
      await this.audit.record(tx, actor, "flights.commercial.changed", id, {
        reason: input.reason,
        before,
        after,
      });
      return after;
    });
  }
  preview(actor: string, id: string, base: string, tax: string) {
    return this.store.run(actor, "pricing", async (tx) => {
      await this.store.get(tx, id);
      const rule = await this.store.rule(tx, id);
      if (!rule)
        throw new AppError(
          "RULE_REQUIRED",
          "Save a commercial rule before previewing.",
        );
      const result = pricePreview(base, tax, rule);
      await this.audit.record(tx, actor, "flights.commercial.preview", id, {
        ruleVersion: rule.version,
      });
      return result;
    });
  }
}
