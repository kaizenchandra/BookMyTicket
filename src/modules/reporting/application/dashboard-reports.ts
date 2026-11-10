import type { Transaction } from "../../../shared/database.ts";
import type {
  DashboardSource,
  DashboardBookings,
  DashboardCatalog,
  DashboardRecordSource,
} from "../../../shared/dashboard.ts";
import { pageScope } from "../../../shared/admin-pagination.ts";
import {
  Dashboard,
  dashboardPeriod,
  dashboardRange,
  type DashboardRange,
} from "./dashboard.ts";
import type { SecurityAudit } from "../contracts/index.ts";
export type DashboardQuery = DashboardRange & {
  year: number;
  group: "month" | "quarter" | "year";
  index: number;
};
export type RecordKind =
  | "bookings"
  | "confirmed"
  | "cancelled"
  | "customers"
  | "captures"
  | "recovery"
  | "refunded"
  | "failed"
  | "exceptions"
  | "support";
export interface DashboardHistoryStore {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  now(tx: Transaction): Promise<Date>;
  save(
    tx: Transaction,
    actor: string,
    filters: unknown,
    report: unknown,
  ): Promise<string>;
  list(tx: Transaction): Promise<unknown>;
  get(tx: Transaction, id: string): Promise<Record<string, any>>;
}
interface DashboardAccess {
  requirePermission(
    tx: Transaction,
    actor: string,
    permission: string,
  ): Promise<void>;
  hasPermission(
    tx: Transaction,
    actor: string,
    permission: string,
  ): Promise<boolean>;
}
export class DashboardReports {
  constructor(
    private store: DashboardHistoryStore,
    private access: DashboardAccess,
    private audit: SecurityAudit,
    private sources: {
      bookings: DashboardBookings;
      payments: DashboardSource;
      inventory: DashboardSource;
      catalog: DashboardCatalog;
      support: DashboardSource;
    },
    private recordsSources: {
      bookings: DashboardRecordSource;
      payments: DashboardRecordSource;
      support: DashboardRecordSource;
    },
  ) {}
  private run<T>(actor: string, work: (tx: Transaction) => Promise<T>) {
    return this.store.transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      return work(tx);
    });
  }
  current(actor: string, query: DashboardQuery) {
    return this.run(actor, async (tx) => {
      const now = await this.store.now(tx),
        s = this.sources;
      const report = {
        ...(await new Dashboard(
          s.bookings,
          s.payments,
          s.inventory,
          s.catalog,
          (await this.access.hasPermission(tx, actor, "support"))
            ? s.support
            : undefined,
        ).read(tx, query.year, query.group, query.index, query, now)),
        asOf: now,
        historical: false,
        definitionVersion: "2",
      };
      const snapshotId = await this.store.save(tx, actor, query, report);
      await this.audit.record(tx, actor, "dashboard.read", snapshotId, query);
      return { ...report, snapshotId };
    });
  }
  history(actor: string) {
    return this.run(actor, async (tx) => {
      await this.audit.record(
        tx,
        actor,
        "dashboard.history.read",
        "history",
        {},
      );
      return this.store.list(tx);
    });
  }
  saved(actor: string, id: string) {
    return this.run(actor, async (tx) => {
      const report = await this.store.get(tx, id);
      if (!(await this.access.hasPermission(tx, actor, "support")))
        report.support = null;
      await this.audit.record(tx, actor, "dashboard.snapshot.read", id, {});
      return report;
    });
  }
  records(
    actor: string,
    query: DashboardQuery,
    kind: RecordKind,
    after?: string,
  ) {
    return this.run(actor, async (tx) => {
      const permission =
        kind === "support"
          ? "support"
          : kind === "customers"
            ? "customers.read"
            : ["bookings", "confirmed", "cancelled"].includes(kind)
              ? "bookings.read"
              : "finance";
      await this.access.requirePermission(tx, actor, permission);
      const now = await this.store.now(tx),
        bounds = query.range
          ? dashboardRange(now, query)
          : dashboardPeriod(query.year, query.group, query.index);
      const listingIds = await this.sources.catalog.match(tx, query),
        bookingIds = await this.sources.bookings.matching(
          tx,
          listingIds,
          query.state,
        );
      const source =
        kind === "support"
          ? this.recordsSources.support
          : ["bookings", "confirmed", "cancelled", "customers"].includes(kind)
            ? this.recordsSources.bookings
            : this.recordsSources.payments;
      const result = await source.records(
        tx,
        { ...bounds, listingIds, bookingIds, state: query.state },
        kind,
        after,
        pageScope(actor, [query, kind, bounds]),
      );
      await this.audit.record(tx, actor, "dashboard.records.read", kind, query);
      return result;
    });
  }
}
