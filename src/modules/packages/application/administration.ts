import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { PackageAllotments } from "../../inventory/contracts/package-allotments.ts";
import { AppError } from "../../../shared/errors.ts";
import {
  definitionErrors,
  completeness,
  packagePrice,
  publicDefinition,
  type Definition,
} from "../domain/package.ts";
export type PackageRecord = {
  id: string;
  code: string;
  content: Definition;
  state: "draft" | "pending_review" | "published";
  version: number;
  created_at: Date;
};
export type Filters = {
  q?: string;
  state?: string;
  destination?: string;
  after?: string;
};
export interface PackageStore {
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
  get(tx: Transaction, id: string): Promise<PackageRecord>;
  list(
    tx: Transaction,
    actor: string | null,
    f: Filters,
  ): Promise<{ items: PackageRecord[]; nextCursor: string | null }>;
  create(tx: Transaction, code: string, content: Definition): Promise<string>;
  save(
    tx: Transaction,
    id: string,
    content: Definition,
    state: string,
  ): Promise<void>;
  history(tx: Transaction, id: string, before?: string): Promise<unknown>;
  record(
    tx: Transaction,
    actor: string,
    p: PackageRecord,
    action: string,
    reason: string,
  ): Promise<void>;
  today(tx: Transaction): Promise<string>;
}
export class PackageAdministration {
  constructor(
    private store: PackageStore,
    private allotments: PackageAllotments,
    private audit: SecurityAudit,
  ) {}
  list(actor: string | null, f: Filters) {
    return this.store.run(actor, "packages.read", async (tx) => {
      const result = await this.store.list(tx, actor, f);
      if (actor)
        await this.audit.record(tx, actor, "packages.read", "directory", {
          count: result.items.length,
        });
      return {
        ...result,
        items: result.items.map((p) =>
          actor
            ? { ...p, completeness: completeness(p.content) }
            : {
                id: p.id,
                code: p.code,
                content: publicDefinition(p.content),
                bookable: false,
              },
        ),
      };
    });
  }
  detail(actor: string, id: string) {
    return this.store.run(actor, "packages.read", async (tx) => {
      const p = await this.store.get(tx, id);
      await this.audit.record(tx, actor, "packages.detail.read", id, {});
      return {
        ...p,
        completeness: completeness(p.content),
        allotments: await this.allotments.list(tx, id),
        fulfillment: {
          state: "not_configured",
          bookable: false,
          confirmations: null,
          message:
            "Supplier reservations, confirmations and compensation are not connected. Allotments are planning limits only.",
        },
      };
    });
  }
  create(
    actor: string,
    key: string,
    i: { code: string; content: Definition; reason: string },
  ) {
    return this.store.run(actor, "packages.manage", (tx) =>
      this.store.once(tx, actor, key, i, async () => {
        this.valid(i.content);
        const id = await this.store.create(tx, i.code, i.content);
        await this.record(
          tx,
          actor,
          await this.store.get(tx, id),
          "created",
          i.reason,
        );
        return { id };
      }),
    );
  }
  edit(
    actor: string,
    id: string,
    i: { content: Definition; expectedVersion: number; reason: string },
  ) {
    return this.store.run(actor, "packages.manage", async (tx) => {
      const p = await this.store.get(tx, id);
      this.version(p, i.expectedVersion);
      if (p.state === "pending_review")
        throw new AppError("STATE_CONFLICT", "Finish review before editing.");
      this.valid(i.content);
      await this.store.save(tx, id, i.content, "draft");
      await this.record(
        tx,
        actor,
        await this.store.get(tx, id),
        "edited",
        i.reason,
      );
      return { updated: true };
    });
  }
  action(
    actor: string,
    id: string,
    i: {
      action: "submit" | "approve" | "reject" | "unpublish";
      expectedVersion: number;
      reason: string;
    },
  ) {
    return this.store.run(
      actor,
      i.action === "submit" ? "packages.manage" : "packages.review",
      async (tx) => {
        const p = await this.store.get(tx, id);
        this.version(p, i.expectedVersion);
        const state =
          i.action === "submit" && p.state === "draft"
            ? "pending_review"
            : i.action === "approve" && p.state === "pending_review"
              ? "published"
              : (i.action === "reject" && p.state === "pending_review") ||
                  (i.action === "unpublish" && p.state === "published")
                ? "draft"
                : null;
        if (!state)
          throw new AppError("STATE_CONFLICT", "Invalid package transition.");
        if (["submit", "approve"].includes(i.action)) {
          this.valid(p.content);
          if (!completeness(p.content).complete)
            throw new AppError(
              "INCOMPLETE_PACKAGE",
              "Complete required package fields before review/publication.",
              422,
            );
          const today = await this.store.today(tx);
          if (!p.content.departures.some((d) => d.start >= today))
            throw new AppError(
              "NO_FUTURE_DEPARTURE",
              "Add a current or future departure before publication.",
              422,
            );
        }
        await this.store.save(tx, id, p.content, state);
        await this.record(
          tx,
          actor,
          await this.store.get(tx, id),
          i.action,
          i.reason,
        );
        return { updated: true };
      },
    );
  }
  preview(
    actor: string,
    id: string,
    i: {
      departure: string;
      adults: number;
      childAges: number[];
      addonIds: string[];
    },
  ) {
    return this.store.run(actor, "packages.read", async (tx) => {
      const p = await this.store.get(tx, id),
        d = p.content;
      if (!completeness(d).complete)
        throw new AppError(
          "INCOMPLETE_PACKAGE",
          "Complete the definition before pricing.",
          422,
        );
      if (
        !d.departures.some((x) => x.start === i.departure) ||
        i.departure < (await this.store.today(tx))
      )
        throw new AppError(
          "INVALID_DEPARTURE",
          "Choose a configured non-past departure.",
          422,
        );
      if (
        i.adults > d.maxAdults ||
        i.childAges.length > d.maxChildren ||
        i.adults + i.childAges.length > d.maxGuests ||
        i.childAges.some((x) => x > d.childMaxAge)
      )
        throw new AppError(
          "OCCUPANCY_CONFLICT",
          "Party exceeds occupancy or child-age policy.",
          422,
        );
      if (i.addonIds.some((x) => !d.addons.some((a) => a.id === x)))
        throw new AppError("INVALID_ADDON", "Unknown add-on.", 422);
      const a = (await this.allotments.list(tx, id)).find(
          (a) => a.departure === i.departure,
        ),
        coverage =
          !!a &&
          a.definitionVersion === p.version &&
          d.components.every((c) => a.components.some((x) => x.id === c.id)),
        planningLimit = coverage
          ? Math.min(
              a!.capacity,
              ...d.components.map(
                (c) => a!.components.find((x) => x.id === c.id)!.capacity,
              ),
            )
          : null;
      await this.audit.record(tx, actor, "packages.price.preview", id, {
        version: p.version,
      });
      return {
        ...packagePrice(d, i.adults, i.childAges.length, i.addonIds),
        definitionVersion: p.version,
        departure: i.departure,
        planningLimit,
        withinPlanningLimit:
          planningLimit === null
            ? null
            : i.adults + i.childAges.length <= planningLimit,
        availability: "unknown",
        supplierConfirmations: null,
      };
    });
  }
  allotment(
    actor: string,
    id: string,
    i: {
      departure: string;
      expectedVersion: number;
      allotmentVersion: number;
      capacity: number;
      components: { id: string; capacity: number }[];
      reason: string;
    },
  ) {
    return this.store.run(actor, "packages.manage", async (tx) => {
      const p = await this.store.get(tx, id);
      this.version(p, i.expectedVersion);
      if (!p.content.departures.some((x) => x.start === i.departure))
        throw new AppError(
          "INVALID_DEPARTURE",
          "Departure not configured.",
          422,
        );
      if (
        i.components.length !== p.content.components.length ||
        new Set(i.components.map((c) => c.id)).size !== i.components.length ||
        i.components.some(
          (c) => !p.content.components.some((x) => x.id === c.id),
        )
      )
        throw new AppError(
          "INVALID_COMPONENTS",
          "Supply exactly one allocation for each package component.",
          422,
        );
      const before =
        (await this.allotments.list(tx, id)).find(
          (a) => a.departure === i.departure,
        ) ?? null;
      await this.allotments.save(
        tx,
        id,
        {
          departure: i.departure,
          definitionVersion: p.version,
          capacity: i.capacity,
          components: i.components,
        },
        i.allotmentVersion,
      );
      const snapshot = {
        ...p,
        allotmentChange: {
          before,
          after: (await this.allotments.list(tx, id)).find(
            (a) => a.departure === i.departure,
          ),
        },
      };
      await this.record(tx, actor, snapshot, "allotment.planned", i.reason);
      return { updated: true, bookable: false };
    });
  }
  history(actor: string, id: string, before?: string) {
    return this.store.run(actor, "packages.read", async (tx) => {
      await this.store.get(tx, id);
      await this.audit.record(tx, actor, "packages.history.read", id, {});
      return this.store.history(tx, id, before);
    });
  }
  private valid(d: Definition) {
    const errors = definitionErrors(d);
    if (errors.length)
      throw new AppError("INVALID_PACKAGE", errors.join(" "), 422);
  }
  private version(p: PackageRecord, v: number) {
    if (p.version !== v)
      throw new AppError(
        "STALE_VERSION",
        "Package changed. Reload before saving.",
      );
  }
  private async record(
    tx: Transaction,
    actor: string,
    p: PackageRecord,
    action: string,
    reason: string,
  ) {
    await this.store.record(tx, actor, p, action, reason);
    await this.audit.record(tx, actor, "packages." + action, p.id, {
      reason,
      version: p.version,
      state: p.state,
    });
  }
}
