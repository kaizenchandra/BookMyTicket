import type { Transaction } from "../../../shared/database.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
import { stayDates, roomNight } from "../domain/hotel.ts";
export type RoomInput = {
  code: string;
  name: string;
  maxGuests: number;
  reason: string;
};
export type RoomEdit = {
  name: string;
  maxGuests: number;
  active: boolean;
  expectedVersion: number;
  reason: string;
};
export type PlanInput = {
  name: string;
  refundable: boolean;
  policy: string;
  basePaise: string;
  includedGuests: number;
  extraGuestPaise: string;
  minStay: number;
  active: boolean;
  expectedVersion: number;
  reason: string;
};
export type BulkInput = {
  from: string;
  until: string;
  planId: string;
  expectedVersion: number;
  capacity: number;
  stopSell: boolean;
  blackout: boolean;
  basePaise: string;
  discountBps: number;
  minStay: number;
  reason: string;
};
export type HoldInput = {
  planId: string;
  checkIn: string;
  checkOut: string;
  quantity: number;
  guestsPerRoom: number;
  reason: string;
};
export type Room = {
  id: string;
  property_id: string;
  code: string;
  name: string;
  max_guests: number;
  active: boolean;
  version: number;
};
export type Plan = {
  id: string;
  room_id: string;
  version: number;
  active: boolean;
  name: string;
  refundable: boolean;
  policy: string;
  base_paise: string;
  included_guests: number;
  extra_guest_paise: string;
  min_stay: number;
};
export type Night = {
  day: string;
  capacity: number | null;
  used: number;
  stop_sell: boolean;
  blackout: boolean;
  base_paise: string;
  discount_bps: number;
  min_stay: number;
};
export type Allocation = {
  id: string;
  owner_id: string;
  state: string;
  fresh: boolean;
  expires_at: Date;
  quote: unknown;
};
export interface HotelInventoryStore {
  unit<T>(
    actor: string,
    permissions: string[],
    target: { room?: string; property?: string },
    work: (tx: Transaction, room: Room | null, state: string) => Promise<T>,
  ): Promise<T>;
  once<T>(
    tx: Transaction,
    actor: string,
    operation: string,
    key: string,
    input: unknown,
    work: () => Promise<T>,
  ): Promise<T>;
  allocatedGuests(tx: Transaction, room: string): Promise<number>;
  rooms(tx: Transaction, property: string): Promise<Room[]>;
  createRoom(
    tx: Transaction,
    property: string,
    input: RoomInput,
  ): Promise<string>;
  editRoom(tx: Transaction, id: string, input: RoomEdit): Promise<void>;
  bump(tx: Transaction, id: string): Promise<void>;
  plans(tx: Transaction, room: string): Promise<Plan[]>;
  savePlan(
    tx: Transaction,
    room: string,
    input: PlanInput,
    id?: string,
  ): Promise<string>;
  nights(
    tx: Transaction,
    room: string,
    plan: string,
    from: string,
    until: string,
  ): Promise<Night[]>;
  bulk(tx: Transaction, room: string, input: BulkInput): Promise<void>;
  today(tx: Transaction): Promise<string>;
  createHold(
    tx: Transaction,
    room: string,
    actor: string,
    input: HoldInput,
    quote: unknown,
  ): Promise<Allocation>;
  allocation(tx: Transaction, room: string, id: string): Promise<Allocation>;
  setState(tx: Transaction, id: string, state: string): Promise<void>;
  allocations(tx: Transaction, room: string, before?: string): Promise<unknown>;
  history(tx: Transaction, room: string, before?: string): Promise<unknown>;
  change(
    tx: Transaction,
    room: string,
    actor: string,
    action: string,
    reason: string,
    details: unknown,
  ): Promise<void>;
}
export class HotelInventory {
  constructor(
    private store: HotelInventoryStore,
    private audit: SecurityAudit,
  ) {}
  private check(room: Room, v: number) {
    if (room.version !== v)
      throw new AppError(
        "STALE_VERSION",
        "Room configuration changed. Reload the calendar.",
      );
  }
  private async planFor(tx: Transaction, room: string, id: string) {
    const p = (await this.store.plans(tx, room)).find((p) => p.id === id);
    if (!p)
      throw new AppError(
        "NOT_FOUND",
        "Rate plan does not belong to this room type.",
        404,
      );
    return p;
  }
  private async changed(
    tx: Transaction,
    room: string,
    actor: string,
    action: string,
    reason: string,
    details: unknown,
  ) {
    await this.store.change(tx, room, actor, action, reason, details);
    await this.audit.record(tx, actor, "hotel.inventory." + action, room, {
      reason,
    });
  }
  rooms(actor: string, property: string) {
    return this.store.unit(actor, [], { property }, async (tx) => {
      const rooms = await this.store.rooms(tx, property);
      return {
        items: await Promise.all(
          rooms.map(async (r) => ({
            ...r,
            plans: await this.store.plans(tx, r.id),
          })),
        ),
      };
    });
  }
  createRoom(actor: string, property: string, key: string, input: RoomInput) {
    return this.store.unit(actor, ["hotels.manage"], { property }, (tx) =>
      this.store.once(
        tx,
        actor,
        "room",
        key,
        { property, ...input },
        async () => {
          const id = await this.store.createRoom(tx, property, input);
          await this.changed(
            tx,
            id,
            actor,
            "room.created",
            input.reason,
            input,
          );
          return { id };
        },
      ),
    );
  }
  editRoom(actor: string, id: string, input: RoomEdit) {
    return this.store.unit(
      actor,
      ["hotels.manage"],
      { room: id },
      async (tx, r) => {
        this.check(r!, input.expectedVersion);
        if ((await this.store.allocatedGuests(tx, id)) > input.maxGuests)
          throw new AppError(
            "OCCUPANCY_CONFLICT",
            "Live holds or future reservations exceed the proposed occupancy limit.",
          );
        const plans = await this.store.plans(tx, id);
        if (plans.some((p) => p.included_guests > input.maxGuests))
          throw new AppError(
            "OCCUPANCY_CONFLICT",
            "Update plan included occupancy before reducing the room limit.",
          );
        await this.store.editRoom(tx, id, input);
        await this.changed(tx, id, actor, "room.edited", input.reason, {
          before: r,
          after: input,
        });
        return { updated: true };
      },
    );
  }
  plan(
    actor: string,
    id: string,
    input: PlanInput,
    key: string,
    planId?: string,
    planVersion?: number,
  ) {
    return this.store.unit(actor, ["pricing"], { room: id }, async (tx, r) => {
      const work = async () => {
        this.check(r!, input.expectedVersion);
        if (input.includedGuests > r!.max_guests)
          throw new AppError(
            "OCCUPANCY_CONFLICT",
            "Included guests exceed the room occupancy limit.",
            422,
          );
        if (
          (await this.store.plans(tx, id)).some(
            (p) =>
              p.id !== planId &&
              p.name.toLowerCase() === input.name.toLowerCase(),
          )
        )
          throw new AppError(
            "DUPLICATE_PLAN",
            "A rate plan with this name already exists.",
          );
        const before = planId ? await this.planFor(tx, id, planId) : null;
        if (before && before.version !== planVersion)
          throw new AppError("STALE_VERSION", "Rate plan changed. Reload.");
        const saved = await this.store.savePlan(tx, id, input, planId);
        await this.store.bump(tx, id);
        await this.changed(tx, id, actor, "plan.saved", input.reason, {
          before,
          after: input,
          planId: saved,
        });
        return { id: saved };
      };
      return planId
        ? work()
        : this.store.once(tx, actor, "plan", key, { id, ...input }, work);
    });
  }
  calendar(
    actor: string,
    id: string,
    plan: string,
    from: string,
    until: string,
  ) {
    return this.store.unit(actor, [], { room: id }, async (tx, r) => {
      await this.planFor(tx, id, plan);
      return {
        room: r,
        plan: await this.planFor(tx, id, plan),
        nights: await this.store.nights(tx, id, plan, from, until),
        currency: "INR",
        timeZone: "Asia/Kolkata",
      };
    });
  }
  bulk(actor: string, id: string, input: BulkInput) {
    return this.store.unit(
      actor,
      ["hotels.manage", "pricing"],
      { room: id },
      async (tx, r) => {
        this.check(r!, input.expectedVersion);
        await this.planFor(tx, id, input.planId);
        const before = await this.store.nights(
          tx,
          id,
          input.planId,
          input.from,
          input.until,
        );
        if (before.some((n) => n.used > input.capacity))
          throw new AppError(
            "CAPACITY_CONFLICT",
            "Capacity cannot be lower than live holds plus reserved rooms.",
          );
        await this.store.bulk(tx, id, input);
        await this.store.bump(tx, id);
        await this.changed(tx, id, actor, "calendar.bulk", input.reason, {
          before,
          after: input,
        });
        return { updated: true, nights: before.length };
      },
    );
  }
  hold(actor: string, id: string, key: string, input: HoldInput) {
    return this.store.unit(
      actor,
      ["hotels.manage"],
      { room: id },
      (tx, r, state) =>
        this.store.once(
          tx,
          actor,
          "hold",
          key,
          { room: id, ...input },
          async () => {
            const plan = await this.planFor(tx, id, input.planId);
            if (state !== "published" || !r!.active || !plan.active)
              throw new AppError(
                "NOT_SELLABLE",
                "A published property and active room/rate plan are required.",
              );
            if (input.guestsPerRoom > r!.max_guests)
              throw new AppError(
                "OCCUPANCY_CONFLICT",
                "Guest count exceeds the room limit.",
                422,
              );
            if (input.checkIn < (await this.store.today(tx)))
              throw new AppError(
                "PAST_STAY",
                "Check-in cannot be in the past.",
                422,
              );
            const nights = await this.store.nights(
                tx,
                id,
                plan.id,
                input.checkIn,
                input.checkOut,
              ),
              days = stayDates(input.checkIn, input.checkOut);
            if (
              nights.length !== days.length ||
              nights.some(
                (n) =>
                  n.capacity === null ||
                  n.stop_sell ||
                  n.blackout ||
                  n.used + input.quantity > n.capacity ||
                  days.length < n.min_stay,
              )
            )
              throw new AppError(
                "INVENTORY_CONFLICT",
                "One or more nights are unavailable or violate minimum stay.",
              );
            const quote = {
              currency: "INR",
              planVersion: plan.version,
              roomVersion: r!.version,
              refundable: plan.refundable,
              policy: plan.policy,
              nights: nights.map((n) => ({
                day: n.day,
                basePaise: n.base_paise,
                discountBps: n.discount_bps,
                totalPaise: roomNight(
                  n.base_paise,
                  plan.extra_guest_paise,
                  plan.included_guests,
                  input.guestsPerRoom,
                  n.discount_bps,
                  input.quantity,
                ),
              })),
              totalPaise: "0",
              bookingCreated: false,
            };
            quote.totalPaise = quote.nights
              .reduce((a, n) => a + BigInt(n.totalPaise), 0n)
              .toString();
            const hold = await this.store.createHold(
              tx,
              id,
              actor,
              input,
              quote,
            );
            await this.changed(tx, id, actor, "held", input.reason, {
              allocationId: hold.id,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              quantity: input.quantity,
              quote,
            });
            return hold;
          },
        ),
    );
  }
  action(
    actor: string,
    id: string,
    allocation: string,
    action: "reserve" | "release",
    reason: string,
  ) {
    return this.store.unit(
      actor,
      ["hotels.manage"],
      { room: id },
      async (tx, r, state) => {
        const a = await this.store.allocation(tx, id, allocation);
        if (action === "reserve") {
          if (a.state === "reserved") return a;
          if (a.state !== "held" || !a.fresh)
            throw new AppError(
              "HOLD_EXPIRED",
              "This hold cannot be consumed; create a new hold.",
            );
          if (state !== "published" || !r!.active)
            throw new AppError(
              "NOT_SELLABLE",
              "Property or room is no longer active.",
            );
          await this.store.setState(tx, a.id, "reserved");
        } else {
          if (["released", "expired"].includes(a.state)) return a;
          await this.store.setState(
            tx,
            a.id,
            a.state === "held" && !a.fresh ? "expired" : "released",
          );
        }
        await this.changed(tx, id, actor, action, reason, {
          allocationId: a.id,
          previousState: a.state,
        });
        return this.store.allocation(tx, id, allocation);
      },
    );
  }
  reconcile(
    actor: string,
    id: string,
    key: string,
    input: {
      from: string;
      until: string;
      planId: string;
      expectedVersion: number;
      observedCapacity: number;
      reason: string;
    },
  ) {
    return this.store.unit(actor, ["hotels.manage"], { room: id }, (tx, r) =>
      this.store.once(
        tx,
        actor,
        "reconcile",
        key,
        { id, ...input },
        async () => {
          this.check(r!, input.expectedVersion);
          await this.planFor(tx, id, input.planId);
          const nights = await this.store.nights(
              tx,
              id,
              input.planId,
              input.from,
              input.until,
            ),
            discrepancies = nights
              .filter((n) => n.capacity !== input.observedCapacity)
              .map((n) => ({
                day: n.day,
                configuredCapacity: n.capacity,
                committed: n.used,
                observedCapacity: input.observedCapacity,
              }));
          await this.changed(
            tx,
            id,
            actor,
            "reconciliation.recorded",
            input.reason,
            {
              from: input.from,
              until: input.until,
              observedCapacity: input.observedCapacity,
              discrepancies,
            },
          );
          return { discrepancies, inventoryChanged: false };
        },
      ),
    );
  }
  history(actor: string, id: string, before?: string) {
    return this.store.unit(actor, [], { room: id }, (tx) =>
      this.store.history(tx, id, before),
    );
  }
  allocations(actor: string, id: string, before?: string) {
    return this.store.unit(actor, [], { room: id }, (tx) =>
      this.store.allocations(tx, id, before),
    );
  }
}
