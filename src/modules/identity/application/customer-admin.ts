import type { Transaction } from "../../../shared/database.ts";
import type {
  CustomerProfiles,
  CustomerBookings,
  CustomerHistory,
  CustomerFilters,
} from "../../../shared/customer-admin.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { pageScope } from "../../../shared/admin-pagination.ts";
export interface CustomerStore {
  run<T>(actor: string, work: (tx: Transaction) => Promise<T>): Promise<T>;
  permissions(
    tx: Transaction,
    actor: string,
  ): Promise<{
    bookings: boolean;
    payments: boolean;
    support: boolean;
    manage: boolean;
  }>;
  require(tx: Transaction, actor: string, permission: string): Promise<void>;
  get(tx: Transaction, id: string): Promise<any>;
  list(
    tx: Transaction,
    actor: string,
    f: CustomerFilters,
    owners: string[] | null,
    names: string[] | null,
  ): Promise<{ items: any[]; nextCursor: string | null }>;
}
export class CustomerAdministration {
  constructor(
    private store: CustomerStore,
    private profiles: CustomerProfiles,
    private bookings: CustomerBookings,
    private payments: CustomerHistory,
    private support: CustomerHistory,
    private audit: SecurityAudit,
  ) {}
  list(actor: string, f: CustomerFilters) {
    return this.store.run(actor, async (tx) => {
      const page = await this.store.list(
          tx,
          actor,
          f,
          await this.bookings.owners(tx, f),
          f.q ? await this.profiles.match(tx, f.q) : null,
        ),
        ids = page.items.map((r) => r.id),
        profiles = await this.profiles.summaries(tx, ids),
        stats = await this.bookings.summaries(tx, ids);
      await this.audit.record(
        tx,
        actor,
        "customers.directory.read",
        "directory",
        { count: ids.length, outcome: "success" },
      );
      return {
        ...page,
        items: page.items.map((r) => ({
          ...r,
          profile: profiles[r.id] ?? { name: "", city: null },
          activity: stats[r.id] ?? {
            bookings: "0",
            confirmed: "0",
            cancelled: "0",
            lastBookingAt: null,
          },
        })),
      };
    });
  }
  detail(actor: string, id: string) {
    return this.store.run(actor, async (tx) => {
      const account = await this.store.get(tx, id),
        profile = await this.profiles.detail(tx, id),
        stats = await this.bookings.summaries(tx, [id]),
        permissions = await this.store.permissions(tx, actor);
      await this.audit.record(tx, actor, "customers.detail.read", account.id, {
        outcome: "success",
      });
      return {
        account,
        profile,
        activity: stats[account.id] ?? {
          bookings: "0",
          confirmed: "0",
          cancelled: "0",
          lastBookingAt: null,
        },
        permissions,
      };
    });
  }
  history(
    actor: string,
    id: string,
    kind: "bookings" | "payments" | "support",
    after?: string,
  ) {
    return this.store.run(actor, async (tx) => {
      await this.store.require(
        tx,
        actor,
        kind === "bookings"
          ? "bookings.read"
          : kind === "payments"
            ? "finance"
            : "support",
      );
      const account = await this.store.get(tx, id),
        scope = pageScope(actor, [account.id, kind]);
      const result =
        kind === "bookings"
          ? await this.bookings.history(tx, account.id, after, scope)
          : await (kind === "payments" ? this.payments : this.support).history(
              tx,
              kind === "payments"
                ? await this.bookings.ids(tx, account.id)
                : [account.id],
              after,
              scope,
            );
      await this.audit.record(tx, actor, "customers.history.read", account.id, {
        kind,
        outcome: "success",
      });
      return result;
    });
  }
}
