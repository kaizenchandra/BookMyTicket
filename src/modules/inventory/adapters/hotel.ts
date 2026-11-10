import { createHash, randomUUID } from "node:crypto";
import { transaction, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type { HotelInventoryTarget } from "../../hotels/contracts/inventory.ts";
import type {
  HotelInventoryStore,
  Room,
  Plan,
  RoomInput,
  RoomEdit,
  PlanInput,
  BulkInput,
  HoldInput,
  Allocation,
  Night,
} from "../application/hotel.ts";
export class PostgresHotelInventory implements HotelInventoryStore {
  constructor(
    private access: StaffAuthorization,
    private hotels: HotelInventoryTarget,
  ) {}
  unit<T>(
    actor: string,
    permissions: string[],
    target: { room?: string; property?: string },
    work: (tx: Transaction, room: Room | null, state: string) => Promise<T>,
  ) {
    return transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "hotels.read");
      for (const p of permissions)
        await this.access.requirePermission(tx, actor, p);
      let property = target.property;
      if (target.room) {
        const row = (
          await tx.query(
            "SELECT property_id FROM inventory.hotel_rooms WHERE id=$1",
            [target.room],
          )
        ).rows[0];
        if (!row) throw new AppError("NOT_FOUND", "Room type not found.", 404);
        property = row.property_id;
      }
      const hotel = await this.hotels.lock(tx, property!);
      const room = target.room
        ? ((
            await tx.query(
              "SELECT * FROM inventory.hotel_rooms WHERE id=$1 FOR UPDATE",
              [target.room],
            )
          ).rows[0] as Room)
        : null;
      return work(tx, room, hotel.state);
    });
  }
  async once<T>(
    tx: Transaction,
    actor: string,
    operation: string,
    key: string,
    input: unknown,
    work: () => Promise<T>,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "hotel-inventory:" + actor + ":" + operation + ":" + key,
    ]);
    const fingerprint = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex"),
      r = (
        await tx.query(
          "SELECT fingerprint,result FROM inventory.hotel_requests WHERE actor_id=$1 AND operation=$2 AND key=$3",
          [actor, operation, key],
        )
      ).rows[0];
    if (r) {
      if (r.fingerprint !== fingerprint)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "Request key already used for different input.",
        );
      return r.result as T;
    }
    const result = await work();
    await tx.query(
      "INSERT INTO inventory.hotel_requests VALUES($1,$2,$3,$4,$5)",
      [actor, operation, key, fingerprint, result],
    );
    return result;
  }
  async allocatedGuests(tx: Transaction, room: string) {
    return Number(
      (
        await tx.query(
          "SELECT coalesce(max(guests_per_room),0) AS maximum FROM inventory.hotel_allocations WHERE room_id=$1 AND check_out>(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date AND (state='reserved' OR state='held' AND expires_at>clock_timestamp())",
          [room],
        )
      ).rows[0].maximum,
    );
  }
  async rooms(tx: Transaction, p: string) {
    return (
      await tx.query(
        "SELECT * FROM inventory.hotel_rooms WHERE property_id=$1 ORDER BY name,id",
        [p],
      )
    ).rows as Room[];
  }
  async createRoom(tx: Transaction, p: string, i: RoomInput) {
    const id = randomUUID(),
      r = await tx.query(
        "INSERT INTO inventory.hotel_rooms(id,property_id,code,name,max_guests) VALUES($1,$2,$3,$4,$5) ON CONFLICT(property_id,code) DO NOTHING RETURNING id",
        [id, p, i.code, i.name, i.maxGuests],
      );
    if (!r.rowCount)
      throw new AppError(
        "DUPLICATE_ROOM",
        "Room code already exists for this property.",
      );
    return id;
  }
  async editRoom(tx: Transaction, id: string, i: RoomEdit) {
    await tx.query(
      "UPDATE inventory.hotel_rooms SET name=$2,max_guests=$3,active=$4,version=version+1 WHERE id=$1",
      [id, i.name, i.maxGuests, i.active],
    );
  }
  async bump(tx: Transaction, id: string) {
    await tx.query(
      "UPDATE inventory.hotel_rooms SET version=version+1 WHERE id=$1",
      [id],
    );
  }
  async plans(tx: Transaction, r: string) {
    return (
      await tx.query(
        "SELECT *,base_paise::text,extra_guest_paise::text FROM inventory.hotel_plans WHERE room_id=$1 ORDER BY name,id",
        [r],
      )
    ).rows as Plan[];
  }
  async savePlan(tx: Transaction, r: string, i: PlanInput, id?: string) {
    const key = id ?? randomUUID();
    if (id)
      await tx.query(
        "UPDATE inventory.hotel_plans SET name=$2,refundable=$3,policy=$4,base_paise=$5,included_guests=$6,extra_guest_paise=$7,min_stay=$8,active=$9,version=version+1 WHERE id=$1",
        [
          id,
          i.name,
          i.refundable,
          i.policy,
          i.basePaise,
          i.includedGuests,
          i.extraGuestPaise,
          i.minStay,
          i.active,
        ],
      );
    else
      await tx.query(
        "INSERT INTO inventory.hotel_plans(id,room_id,name,refundable,policy,base_paise,included_guests,extra_guest_paise,min_stay,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          key,
          r,
          i.name,
          i.refundable,
          i.policy,
          i.basePaise,
          i.includedGuests,
          i.extraGuestPaise,
          i.minStay,
          i.active,
        ],
      );
    return key;
  }
  async nights(
    tx: Transaction,
    r: string,
    p: string,
    from: string,
    until: string,
  ) {
    return (
      await tx.query(
        `SELECT to_char(d.day,'YYYY-MM-DD') AS day,stock.capacity,coalesce(stock.stop_sell,false) AS stop_sell,coalesce(stock.blackout,false) AS blackout,coalesce(rate.base_paise,plan.base_paise)::text AS base_paise,coalesce(rate.discount_bps,0) AS discount_bps,coalesce(rate.min_stay,plan.min_stay) AS min_stay,coalesce((SELECT sum(a.quantity) FROM inventory.hotel_allocations a WHERE a.room_id=$1 AND a.check_in<=d.day AND a.check_out>d.day AND (a.state='reserved' OR a.state='held' AND a.expires_at>clock_timestamp())),0)::integer AS used FROM generate_series($3::date,$4::date-1,interval '1 day') d(day) CROSS JOIN inventory.hotel_plans plan LEFT JOIN inventory.hotel_days stock ON stock.room_id=$1 AND stock.day=d.day LEFT JOIN inventory.hotel_rates rate ON rate.plan_id=$2 AND rate.day=d.day WHERE plan.id=$2 AND plan.room_id=$1 ORDER BY d.day`,
        [r, p, from, until],
      )
    ).rows as Night[];
  }
  async bulk(tx: Transaction, r: string, i: BulkInput) {
    await tx.query(
      "INSERT INTO inventory.hotel_days(room_id,day,capacity,stop_sell,blackout) SELECT $1,d,$4,$5,$6 FROM generate_series($2::date,$3::date-1,interval '1 day') d ON CONFLICT(room_id,day) DO UPDATE SET capacity=excluded.capacity,stop_sell=excluded.stop_sell,blackout=excluded.blackout",
      [r, i.from, i.until, i.capacity, i.stopSell, i.blackout],
    );
    await tx.query(
      "INSERT INTO inventory.hotel_rates(plan_id,day,base_paise,discount_bps,min_stay) SELECT $1,d,$4,$5,$6 FROM generate_series($2::date,$3::date-1,interval '1 day') d ON CONFLICT(plan_id,day) DO UPDATE SET base_paise=excluded.base_paise,discount_bps=excluded.discount_bps,min_stay=excluded.min_stay",
      [i.planId, i.from, i.until, i.basePaise, i.discountBps, i.minStay],
    );
  }
  async today(tx: Transaction) {
    return (
      await tx.query(
        "SELECT to_char(clock_timestamp() AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS today",
      )
    ).rows[0].today as string;
  }
  async createHold(
    tx: Transaction,
    r: string,
    actor: string,
    i: HoldInput,
    quote: unknown,
  ) {
    const id = randomUUID();
    await tx.query(
      "INSERT INTO inventory.hotel_allocations(id,room_id,plan_id,owner_id,check_in,check_out,quantity,guests_per_room,state,expires_at,quote) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'held',clock_timestamp()+interval '10 minutes',$9)",
      [
        id,
        r,
        i.planId,
        actor,
        i.checkIn,
        i.checkOut,
        i.quantity,
        i.guestsPerRoom,
        quote,
      ],
    );
    return this.allocation(tx, r, id);
  }
  async allocation(tx: Transaction, r: string, id: string) {
    const row = (
      await tx.query(
        "SELECT *,sequence::text,to_char(check_in,'YYYY-MM-DD') AS check_in,to_char(check_out,'YYYY-MM-DD') AS check_out,expires_at>clock_timestamp() AS fresh FROM inventory.hotel_allocations WHERE room_id=$1 AND id=$2 FOR UPDATE",
        [r, id],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "NOT_FOUND",
        "Allocation not found for this room type.",
        404,
      );
    return row as Allocation;
  }
  async setState(tx: Transaction, id: string, state: string) {
    const result = await tx.query(
      "UPDATE inventory.hotel_allocations SET state=$2 WHERE id=$1 AND ($2::text<>'reserved' OR state='held' AND expires_at>clock_timestamp()) RETURNING id",
      [id, state],
    );
    if (!result.rowCount)
      throw new AppError(
        "HOLD_EXPIRED",
        "Hold expired before consumption. Create a new hold.",
      );
  }
  async allocations(tx: Transaction, r: string, before?: string) {
    const rows = (
      await tx.query(
        "SELECT *,sequence::text,to_char(check_in,'YYYY-MM-DD') AS check_in,to_char(check_out,'YYYY-MM-DD') AS check_out,CASE WHEN state='held' AND expires_at<=clock_timestamp() THEN 'expired' ELSE state END AS effective_state FROM inventory.hotel_allocations a WHERE room_id=$1 AND ($2::bigint IS NULL OR a.sequence<$2) ORDER BY a.sequence DESC LIMIT 26",
        [r, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].sequence : null,
    };
  }
  async history(tx: Transaction, r: string, before?: string) {
    const rows = (
      await tx.query(
        "SELECT *,id::text FROM inventory.hotel_changes h WHERE room_id=$1 AND ($2::bigint IS NULL OR h.id<$2) ORDER BY h.id DESC LIMIT 26",
        [r, before ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25),
      nextBefore: rows.length > 25 ? rows[24].id : null,
    };
  }
  async change(
    tx: Transaction,
    r: string,
    actor: string,
    action: string,
    reason: string,
    details: unknown,
  ) {
    await tx.query(
      "INSERT INTO inventory.hotel_changes(room_id,actor_id,action,reason,details) VALUES($1,$2,$3,$4,$5)",
      [r, actor, action, reason, details],
    );
  }
}
