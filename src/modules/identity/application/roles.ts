import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export type RoleInput = {
  name: string;
  description: string;
  permissions: string[];
  reason: string;
};
export type RoleUpdate = RoleInput & {
  expectedVersion: number;
  active: boolean;
};
export type AdminCreation = {
  contact: string;
  name: string;
  roles: string[];
  permissions: string[];
  reason: string;
};
export interface RoleStore {
  run<T>(actor: string, work: (tx: Transaction) => Promise<T>): Promise<T>;
  once<T>(
    tx: Transaction,
    actor: string,
    operation: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  role(
    tx: Transaction,
    id: string,
  ): Promise<{
    id: string;
    version: number;
    name: string;
    description: string;
    active: boolean;
    permissions: string[];
  }>;
  create(tx: Transaction, input: RoleInput): Promise<string>;
  members(tx: Transaction, id: string): Promise<string[]>;
  update(tx: Transaction, id: string, input: RoleUpdate): Promise<void>;
  refresh(tx: Transaction, ids: string[]): Promise<void>;
  createAccount(tx: Transaction, input: AdminCreation): Promise<{ id: string }>;
}
export class AdminRoles {
  constructor(
    private store: RoleStore,
    private audit: SecurityAudit,
  ) {}
  create(actor: string, input: RoleInput, key: string) {
    return this.store.run(actor, (tx) =>
      this.store.once(tx, actor, "role.create", key, input, async () => {
        const id = await this.store.create(tx, input),
          result = await this.store.role(tx, id);
        await this.audit.record(tx, actor, "identity.role.created", id, {
          reason: input.reason,
          after: result,
          outcome: "success",
        });
        return result;
      }),
    );
  }
  update(actor: string, id: string, input: RoleUpdate) {
    actor = actor.toLowerCase();
    id = id.toLowerCase();
    return this.store.run(actor, async (tx) => {
      const before = await this.store.role(tx, id);
      if (before.version !== input.expectedVersion)
        throw new AppError(
          "STALE_VERSION",
          "Role changed. Reload before saving.",
        );
      const members = await this.store.members(tx, id);
      if (members.includes(actor))
        throw new AppError(
          "SELF_CHANGE_DENIED",
          "Another access administrator must edit a role assigned to you.",
          403,
        );
      await this.store.update(tx, id, input);
      await this.store.refresh(tx, members);
      const after = await this.store.role(tx, id);
      await this.audit.record(tx, actor, "identity.role.changed", id, {
        reason: input.reason,
        before,
        after,
        affectedAccounts: members,
        outcome: "success",
      });
      return after;
    });
  }
  createAccount(actor: string, input: AdminCreation, key: string) {
    return this.store.run(actor, (tx) =>
      this.store.once(tx, actor, "admin.create", key, input, async () => {
        const result = await this.store.createAccount(tx, input);
        await this.audit.record(
          tx,
          actor,
          "identity.admin.created",
          result.id,
          {
            reason: input.reason,
            roles: input.roles,
            permissions: input.permissions,
            outcome: "success",
          },
        );
        return result;
      }),
    );
  }
}
