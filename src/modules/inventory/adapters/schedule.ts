import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type {
  PublishedCatalog,
  CatalogSessions,
} from "../../catalog/contracts/index.ts";
import type { ScheduledPlan } from "../../venues/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  ScheduleStore,
  ScheduleInput,
} from "../application/scheduling.ts";
import { AppError } from "../../../shared/errors.ts";
export class PostgresSchedule implements ScheduleStore {
  constructor(
    private access: OrganizationAccess,
    private catalog: PublishedCatalog & CatalogSessions,
    private audit: SecurityAudit,
  ) {}
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async previousSeries(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,5))", [
      actor,
    ]);
    const row = (
      await tx.query(
        "SELECT fingerprint,occurrence_ids FROM inventory.schedule_series WHERE actor_id=$1 AND operation_key=$2",
        [actor, key],
      )
    ).rows[0];
    if (!row) return null;
    if (row.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This series key was used with different input.",
        409,
      );
    return { ids: row.occurrence_ids as string[] };
  }
  async saveSeries(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
    ids: string[],
  ) {
    await tx.query(
      "INSERT INTO inventory.schedule_series(actor_id,operation_key,fingerprint,occurrence_ids) VALUES($1,$2,$3,$4)",
      [actor, key, fingerprint, JSON.stringify(ids)],
    );
  }
  async previous(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
  ) {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,5))", [
      actor,
    ]);
    const r = (
      await tx.query(
        "SELECT fingerprint,occurrence_id FROM inventory.schedule_commands WHERE actor_id=$1 AND operation_key=$2",
        [actor, key],
      )
    ).rows[0];
    if (!r) return null;
    if (r.fingerprint !== fingerprint)
      throw new AppError(
        "IDEMPOTENCY_CONFLICT",
        "This scheduling key was already used for different input.",
        409,
      );
    return { id: r.occurrence_id };
  }
  async persist(
    tx: Transaction,
    actor: string,
    key: string,
    fingerprint: string,
    input: ScheduleInput,
    plan: ScheduledPlan,
  ) {
    const future = (
      await tx.query("SELECT $1::timestamptz>clock_timestamp() valid", [
        input.startsAt,
      ])
    ).rows[0].valid;
    if (!future)
      throw new AppError(
        "INVALID_SCHEDULE",
        "New occurrences must start in the future.",
        422,
      );
    const conflicts = await tx.query(
      "SELECT id FROM inventory.occurrences WHERE space_id=$1 AND state<>'cancelled' AND starts_at<$3::timestamptz+make_interval(mins=>$4) AND ends_at+make_interval(mins=>turnaround_minutes)>$2::timestamptz LIMIT 1",
      [plan.spaceId, input.startsAt, input.endsAt, plan.turnaroundMinutes],
    );
    if (conflicts.rowCount)
      throw new AppError(
        "SCHEDULE_CONFLICT",
        "This space is already scheduled during the requested time or turnaround period.",
        409,
      );
    const id = randomUUID();
    await tx.query(
      "INSERT INTO inventory.occurrences(id,listing_id,organization_id,venue_name,time_zone,starts_at,ends_at,sales_open,sales_close,space_id,plan_id,venue_snapshot,turnaround_minutes,is_demo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)",
      [
        id,
        input.listingId,
        input.organizationId,
        `${plan.venueName} · ${plan.spaceName}`,
        plan.timeZone,
        input.startsAt,
        input.endsAt,
        input.salesOpen,
        input.salesClose,
        plan.spaceId,
        plan.id,
        plan,
        plan.turnaroundMinutes,
        input.demo ?? false,
      ],
    );
    await this.catalog.recordSession(tx, {
      id,
      listingId: input.listingId,
      startsAt: input.startsAt,
      timeZone: plan.timeZone,
      venueName: `${plan.venueName} · ${plan.spaceName}`,
      state: "open",
    });
    for (const r of plan.configuration.resources)
      await tx.query(
        "INSERT INTO inventory.resources(occurrence_id,id,kind,label,capacity,price_paise) VALUES($1,$2,$3,$4,$5,$6)",
        [id, r.id, r.kind, r.label, r.capacity, input.prices[r.id]],
      );
    await tx.query(
      "INSERT INTO inventory.schedule_commands(actor_id,operation_key,fingerprint,occurrence_id) VALUES($1,$2,$3,$4)",
      [actor, key, fingerprint, id],
    );
    await this.audit.record(tx, actor, "occurrence.scheduled", id, {
      organizationId: input.organizationId,
      planId: plan.id,
      planVersion: plan.version,
    });
    return { id };
  }
  async forListing(id: string) {
    await this.catalog.requirePublished(id);
    return (
      await pool.query(
        "SELECT o.id,o.venue_name,o.time_zone,o.starts_at,o.ends_at,o.state,o.plan_id,o.is_demo,clock_timestamp()>=o.sales_open AND clock_timestamp()<o.sales_close AS sales_valid,(SELECT min(price_paise) FROM inventory.resources WHERE occurrence_id=o.id) AS min_price_paise,coalesce((SELECT sum(greatest(r.capacity-r.sold-coalesce((SELECT sum(i.quantity) FROM inventory.reservation_items i JOIN inventory.reservations h ON h.id=i.reservation_id WHERE i.occurrence_id=r.occurrence_id AND i.resource_id=r.id AND h.state='active' AND h.expires_at>clock_timestamp()),0),0)) FROM inventory.resources r WHERE r.occurrence_id=o.id),0)::int AS available_units FROM inventory.occurrences o WHERE o.listing_id=$1 ORDER BY o.starts_at LIMIT 100",
        [id],
      )
    ).rows;
  }
  async forOrganization(actor: string, org: string) {
    await this.access.requireMember(actor, org);
    return (
      await pool.query(
        "SELECT id,listing_id,venue_name,time_zone,starts_at,ends_at,state,plan_id,space_id,turnaround_minutes FROM inventory.occurrences WHERE organization_id=$1 ORDER BY starts_at DESC LIMIT 100",
        [org],
      )
    ).rows;
  }
}
