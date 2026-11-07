import { createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { PublishedCatalog } from "../../catalog/contracts/index.ts";
import type {
  VenuePlans,
  ScheduledPlan,
} from "../../venues/contracts/index.ts";
export type ScheduleInput = {
  demo?: boolean;
  organizationId: string;
  listingId: string;
  planId: string;
  startsAt: string;
  endsAt: string;
  salesOpen: string;
  salesClose: string;
  prices: Record<string, number>;
};
export interface ScheduleStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  previous(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
  ): Promise<{ id: string } | null>;
  persist(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
    input: ScheduleInput,
    plan: ScheduledPlan,
  ): Promise<{ id: string }>;
  forListing(id: string): Promise<unknown>;
  forOrganization(actor: string, org: string): Promise<unknown>;
}
export class Scheduling {
  constructor(
    private store: ScheduleStore,
    private access: OrganizationAccess,
    private catalog: PublishedCatalog,
    private plans: VenuePlans,
  ) {}
  create(actor: string, key: string, input: ScheduleInput) {
    if (key.length < 8 || key.length > 100)
      throw new AppError(
        "INVALID_IDEMPOTENCY_KEY",
        "Use a stable scheduling operation key.",
        422,
      );
    const times = [
      input.startsAt,
      input.endsAt,
      input.salesOpen,
      input.salesClose,
    ].map(Date.parse);
    if (
      times.some((t) => !Number.isFinite(t)) ||
      times[1] <= times[0] ||
      times[3] <= times[2] ||
      times[3] > times[0]
    )
      throw new AppError(
        "INVALID_SCHEDULE",
        "Check occurrence and sales window ordering.",
        422,
      );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...input,
          prices: Object.fromEntries(
            Object.entries(input.prices).sort(([a], [b]) => a.localeCompare(b)),
          ),
        }),
      )
      .digest("hex");
    return this.store.unitOfWork(async (tx) => {
      await this.access.requireMember(actor, input.organizationId, true, tx);
      await this.access.requireApproved(input.organizationId, tx);
      const previous = await this.store.previous(tx, actor, key, fingerprint);
      if (previous) return previous;
      await this.catalog.requireOwnedPublished(
        input.listingId,
        input.organizationId,
        tx,
      );
      const plan = await this.plans.lockForSchedule(
        tx,
        input.organizationId,
        input.planId,
      );
      // Explicit offsets must agree with venue-local intent; this rejects DST gaps
      // and lets callers choose the intended offset during a repeated local hour.
      for (const value of [
        input.startsAt,
        input.endsAt,
        input.salesOpen,
        input.salesClose,
      ]) {
        if (value.endsWith("Z")) continue;
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: plan.timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).formatToParts(new Date(value));
        const part = (name: string) =>
          parts.find((p) => p.type === name)!.value;
        const local = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
        if (local !== value.slice(0, 16))
          throw new AppError(
            "TIME_ZONE_OFFSET_MISMATCH",
            "The entered UTC offset does not match this venue and date. Check daylight-saving changes and enter each affected date with its correct offset.",
            422,
          );
      }
      const ids = plan.configuration.resources.map((r) => r.id);
      if (
        Object.keys(input.prices).length !== ids.length ||
        ids.some(
          (id) =>
            !Object.hasOwn(input.prices, id) ||
            !Number.isSafeInteger(input.prices[id]) ||
            input.prices[id] < 0 ||
            input.prices[id] > 100000000,
        )
      )
        throw new AppError(
          "PRICE_CONFIGURATION",
          "Provide exactly one valid price for every plan resource.",
          422,
        );
      return this.store.persist(tx, actor, key, fingerprint, input, plan);
    });
  }
  forListing(id: string) {
    return this.store.forListing(id);
  }
  forOrganization(actor: string, org: string) {
    return this.store.forOrganization(actor, org);
  }
}
