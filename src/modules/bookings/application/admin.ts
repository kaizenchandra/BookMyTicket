import type { BookingCatalog } from "../../catalog/contracts/booking-admin.ts";
import type { Transaction } from "../../../shared/database.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { PaymentHistory } from "../../payments/contracts/history.ts";
import type { AdminFulfillment } from "../../ticketing/contracts/admin.ts";
export type AdminBookingFilters = {
  id?: string;
  customer?: string;
  state?: string;
  from?: string;
  until?: string;
  confirmed?: "true";
  after?: string;
  product?: string;
  supplier?: string;
  travelFrom?: string;
  travelUntil?: string;
  pnr?: string;
  exception?: string;
  assignedTo?: string;
  listingIds?: string[] | null;
};
export interface AdminBookingStore {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  list(
    tx: Transaction,
    actor: string,
    filters: AdminBookingFilters,
  ): Promise<unknown>;
  detail(tx: Transaction, id: string): Promise<unknown>;
}
export class AdminBookings {
  constructor(
    private store: AdminBookingStore,
    private access: StaffAuthorization,
    private audit: SecurityAudit,
    private payments: PaymentHistory,
    private tickets: AdminFulfillment,
    private catalog: BookingCatalog,
  ) {}
  private run<T>(
    actor: string,
    target: string,
    work: (tx: Transaction) => Promise<T>,
  ) {
    return this.store.transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "bookings.read");
      const result = await work(tx);
      await this.audit.record(tx, actor, "bookings.admin.read", target, {
        outcome: "success",
      });
      return result;
    });
  }
  list(actor: string, filters: AdminBookingFilters) {
    return this.run(actor, "directory", async (tx) =>
      this.store.list(tx, actor, {
        ...filters,
        listingIds: await this.catalog.match(tx, filters),
      }),
    );
  }
  detail(actor: string, id: string) {
    return this.run(actor, id, async (tx) => ({
      booking: await this.store.detail(tx, id),
      fulfillment: await this.tickets.summary(tx, id),
      payments: await this.payments.read(tx, id),
    }));
  }
  paymentHistory(actor: string, id: string, after?: string) {
    return this.run(actor, id, async (tx) => {
      await this.store.detail(tx, id);
      return this.payments.read(tx, id, after);
    });
  }
}
