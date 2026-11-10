import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  completeness,
  transition,
  publicContent,
  type Content,
  type State,
  type Action,
} from "../domain/property.ts";
export type Property = {
  id: string;
  code: string;
  content: Content;
  state: State;
  version: number;
  created_at: Date;
};
export type Filters = {
  q?: string;
  city?: string;
  kind?: "hotel" | "homestay";
  state?: State;
  after?: string;
  south?: number;
  north?: number;
  west?: number;
  east?: number;
};
export interface PropertyStore {
  run<T>(
    actor: string | null,
    permission: string,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T>;
  once<T>(
    tx: Transaction,
    actor: string,
    key: string,
    input: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  get(tx: Transaction, id: string): Promise<Property>;
  list(
    tx: Transaction,
    actor: string | null,
    f: Filters,
  ): Promise<{ items: Property[]; nextCursor: string | null }>;
  create(tx: Transaction, code: string, c: Content): Promise<string>;
  save(tx: Transaction, id: string, c: Content, state: State): Promise<void>;
  history(tx: Transaction, id: string, before?: number): Promise<unknown>;
  revision(
    tx: Transaction,
    p: Property,
    actor: string,
    action: string,
    reason: string,
  ): Promise<void>;
}
export class PropertyAdministration {
  constructor(
    private store: PropertyStore,
    private audit: SecurityAudit,
  ) {}
  list(actor: string | null, f: Filters) {
    return this.store.run(actor, "hotels.read", async (tx) => {
      const page = await this.store.list(tx, actor, f);
      if (actor)
        await this.audit.record(
          tx,
          actor,
          "hotels.directory.read",
          "directory",
          { count: page.items.length },
        );
      return {
        ...page,
        items: page.items.map((p) =>
          actor
            ? { ...p, completeness: completeness(p.content) }
            : {
                id: p.id,
                code: p.code,
                version: p.version,
                content: publicContent(p.content),
                bookable: false,
              },
        ),
      };
    });
  }
  detail(actor: string, id: string) {
    return this.store.run(actor, "hotels.read", async (tx) => {
      const p = await this.store.get(tx, id);
      await this.audit.record(tx, actor, "hotels.property.read", id, {});
      return { ...p, completeness: completeness(p.content) };
    });
  }
  history(actor: string, id: string, before?: number) {
    return this.store.run(actor, "hotels.read", async (tx) => {
      await this.store.get(tx, id);
      const result = await this.store.history(tx, id, before);
      await this.audit.record(tx, actor, "hotels.history.read", id, {});
      return result;
    });
  }
  create(
    actor: string,
    key: string,
    input: { code: string; content: Content; reason: string },
  ) {
    return this.store.run(actor, "hotels.manage", (tx) =>
      this.store.once(tx, actor, key, input, async () => {
        const id = await this.store.create(tx, input.code, input.content),
          p = await this.store.get(tx, id);
        await this.record(tx, actor, p, "create", input.reason, null);
        return { id };
      }),
    );
  }
  edit(
    actor: string,
    id: string,
    input: { content: Content; expectedVersion: number; reason: string },
  ) {
    return this.store.run(actor, "hotels.manage", async (tx) => {
      const before = await this.store.get(tx, id);
      this.version(before, input.expectedVersion);
      if (
        before.state === "pending_review" ||
        before.state === "suspended" ||
        before.state === "delisted"
      )
        throw new AppError(
          "STATE_CONFLICT",
          "Reopen or finish review before editing this property.",
        );
      await this.store.save(tx, id, input.content, "draft");
      const after = await this.store.get(tx, id);
      await this.record(tx, actor, after, "edit", input.reason, before);
      return { ...after, completeness: completeness(after.content) };
    });
  }
  action(
    actor: string,
    id: string,
    input: { action: Action; expectedVersion: number; reason: string },
  ) {
    return this.store.run(
      actor,
      input.action === "submit" ? "hotels.manage" : "hotels.review",
      async (tx) => {
        const before = await this.store.get(tx, id);
        this.version(before, input.expectedVersion);
        const state = transition(before.state, input.action);
        if (!state)
          throw new AppError(
            "STATE_CONFLICT",
            "Action is not allowed in the current property state.",
          );
        if (
          ["submit", "approve"].includes(input.action) &&
          !completeness(before.content).complete
        )
          throw new AppError(
            "INCOMPLETE_PROPERTY",
            "Complete required listing fields before review or publication.",
            422,
          );
        await this.store.save(tx, id, before.content, state);
        const after = await this.store.get(tx, id);
        await this.record(tx, actor, after, input.action, input.reason, before);
        return { ...after, completeness: completeness(after.content) };
      },
    );
  }
  private version(p: Property, v: number) {
    if (p.version !== v)
      throw new AppError(
        "STALE_VERSION",
        "Property changed. Reload before saving.",
      );
  }
  private async record(
    tx: Transaction,
    actor: string,
    p: Property,
    action: string,
    reason: string,
    before: Property | null,
  ) {
    await this.store.revision(tx, p, actor, action, reason);
    await this.audit.record(tx, actor, "hotels.property." + action, p.id, {
      reason,
      before: before ? { version: before.version, state: before.state } : null,
      after: { version: p.version, state: p.state },
    });
  }
}
