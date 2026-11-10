import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
export const adminPermissions = [
  "access.manage",
  "cabs.read",
  "cabs.manage",
  "packages.read",
  "packages.manage",
  "packages.review",
  "trains.read",
  "trains.manage",
  "buses.read",
  "buses.manage",
  "hotels.read",
  "hotels.manage",
  "hotels.review",
  "flights.read",
  "flights.manage",
  "customers.read",
  "bookings.read",
  "bookings.manage",
  "finance",
  "support",
  "support_assign",
  "moderate",
  "pricing",
  "audit",
] as const;
export type AccountChange = {
  expectedVersion: number;
  reason: string;
  status?: "active" | "suspended";
  permissions?: string[];
  roles?: string[];
  name?: string;
  customerFlags?: string[];
};
export interface AccountAdministrationStore {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  lock(tx: Transaction): Promise<void>;
  authorize(tx: Transaction, actor: string): Promise<void>;
  get(
    tx: Transaction,
    id: string,
  ): Promise<{
    id: string;
    status: string;
    version: number;
    permissions: string[];
  }>;
  otherManagers(tx: Transaction, id: string): Promise<number>;
  update(tx: Transaction, id: string, change: AccountChange): Promise<void>;
}
export class AccountAdministration {
  constructor(
    private store: AccountAdministrationStore,
    private audit: SecurityAudit,
  ) {}
  change(actor: string, id: string, change: AccountChange) {
    actor = actor.toLowerCase();
    id = id.toLowerCase();
    return this.store.transaction(async (tx) => {
      await this.store.lock(tx);
      await this.store.authorize(tx, actor);
      if (actor === id)
        throw new AppError(
          "SELF_CHANGE_DENIED",
          "Another access administrator must change your account.",
          403,
        );
      const before = await this.store.get(tx, id);
      if (before.version !== change.expectedVersion)
        throw new AppError(
          "STALE_VERSION",
          "Account changed. Reload before applying your change.",
        );
      const remainsManager =
        (change.status ?? before.status) === "active" &&
        (change.permissions ?? before.permissions).includes("access.manage");
      if (
        before.status === "active" &&
        before.permissions.includes("access.manage") &&
        !remainsManager &&
        (await this.store.otherManagers(tx, id)) === 0
      )
        throw new AppError(
          "LAST_ADMIN",
          "The last active access administrator cannot be removed.",
        );
      await this.store.update(tx, id, change);
      const after = await this.store.get(tx, id);
      await this.audit.record(tx, actor, "identity.admin.changed", id, {
        reason: change.reason,
        before,
        after,
        outcome: "success",
      });
      return after;
    });
  }
}
