import type { Transaction } from "../../../shared/database.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type {
  SecurityAudit,
  DurableEvents,
} from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export type ExceptionInput = {
  action: "open" | "assign" | "escalate" | "resolve" | "reopen";
  expectedVersion: number;
  reason: string;
  assignedTo?: string | null;
};
export type ExceptionRecord = {
  order_id: string;
  state: "open" | "escalated" | "resolved";
  assigned_to: string | null;
  version: number;
};
export interface ExceptionStore {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  lockBooking(tx: Transaction, id: string): Promise<void>;
  read(tx: Transaction, id: string): Promise<ExceptionRecord | null>;
  history(tx: Transaction, id: string, before?: string): Promise<unknown>;
  once<T>(
    tx: Transaction,
    actor: string,
    key: string,
    payload: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  save(
    tx: Transaction,
    id: string,
    actor: string,
    input: ExceptionInput,
    before: ExceptionRecord | null,
    state: ExceptionRecord["state"],
    assignee: string | null,
  ): Promise<ExceptionRecord>;
}
export class BookingExceptions {
  constructor(
    private store: ExceptionStore,
    private access: StaffAuthorization,
    private audit: SecurityAudit,
    private events: DurableEvents,
  ) {}
  detail(actor: string, id: string, before?: string) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "bookings.read");
      await this.store.lockBooking(tx, id);
      const result = {
        exception: await this.store.read(tx, id),
        history: await this.store.history(tx, id, before),
      };
      await this.audit.record(tx, actor, "bookings.exception.read", id, {});
      return result;
    });
  }
  change(actor: string, id: string, key: string, input: ExceptionInput) {
    return this.store.run(async (tx) => {
      await this.access.requirePermission(tx, actor, "bookings.read");
      await this.access.requirePermission(tx, actor, "bookings.manage");
      return this.store.once(tx, actor, key, { id, ...input }, async () => {
        await this.store.lockBooking(tx, id);
        const prior = await this.store.read(tx, id);
        if ((prior?.version ?? 0) !== input.expectedVersion)
          throw new AppError(
            "STALE_VERSION",
            "Exception changed. Reload before applying an action.",
          );
        let state = prior?.state ?? "open",
          assignee = prior?.assigned_to ?? null;
        if (input.action === "open") {
          if (prior)
            throw new AppError(
              "STATE_CONFLICT",
              "This booking already has an exception record.",
            );
        } else {
          if (!prior)
            throw new AppError("STATE_CONFLICT", "Open an exception first.");
          if (input.action === "reopen") {
            if (state !== "resolved")
              throw new AppError(
                "STATE_CONFLICT",
                "Only resolved cases can be reopened.",
              );
            state = "open";
          } else {
            if (state === "resolved")
              throw new AppError(
                "STATE_CONFLICT",
                "Reopen a resolved exception before changing it.",
              );
            if (input.action === "escalate") {
              if (state === "escalated")
                throw new AppError("STATE_CONFLICT", "Already escalated.");
              state = "escalated";
            }
            if (input.action === "resolve") state = "resolved";
            if (input.action === "assign") assignee = input.assignedTo ?? null;
          }
        }
        if (input.action === "assign" && assignee) {
          await this.access.requirePermission(tx, assignee, "bookings.read");
          await this.access.requirePermission(tx, assignee, "bookings.manage");
        }
        const result = await this.store.save(
          tx,
          id,
          actor,
          input,
          prior,
          state,
          assignee,
        );
        await this.audit.record(
          tx,
          actor,
          "bookings.exception." + input.action,
          id,
          { reason: input.reason, before: prior, after: result },
        );
        await this.events.publish(tx, "booking.exception_changed", id, {
          actorId: actor,
          action: input.action,
          version: result.version,
          state,
        });
        return result;
      });
    });
  }
}
