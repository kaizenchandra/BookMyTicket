import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type {
  VenueStore,
  VenueInput,
  SpaceInput,
} from "../application/venues.ts";
import type { VenuePlans, ScheduledPlan } from "../contracts/index.ts";
import { validatePlan, type Plan } from "../domain/plan.ts";
export class PostgresVenues implements VenueStore, VenuePlans {
  constructor(
    private access: OrganizationAccess,
    private audit: SecurityAudit,
  ) {}
  async list(actor: string, org: string) {
    await this.access.requireMember(actor, org);
    const venues = (
      await pool.query(
        "SELECT * FROM venues.venues WHERE organization_id=$1 ORDER BY name,id LIMIT 100",
        [org],
      )
    ).rows;
    const spaces = (
      await pool.query(
        "SELECT s.* FROM venues.spaces s JOIN venues.venues v ON v.id=s.venue_id WHERE v.organization_id=$1 ORDER BY s.name,s.id LIMIT 500",
        [org],
      )
    ).rows;
    const plans = (
      await pool.query(
        "SELECT p.* FROM venues.plans p JOIN venues.spaces s ON s.id=p.space_id JOIN venues.venues v ON v.id=s.venue_id WHERE v.organization_id=$1 ORDER BY p.space_id,p.version DESC LIMIT 500",
        [org],
      )
    ).rows;
    return { venues, spaces, plans };
  }
  create(actor: string, org: string, input: VenueInput) {
    return transaction(async (tx) => {
      await this.access.requireMember(actor, org, true, tx);
      try {
        new Intl.DateTimeFormat("en-IN", { timeZone: input.timeZone }).format();
      } catch {
        throw new AppError("INVALID_TIME_ZONE", "Use an IANA time zone.", 422);
      }
      const id = randomUUID();
      await tx.query(
        "INSERT INTO venues.venues(id,organization_id,name,address,city,time_zone,amenities,accessibility) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          org,
          input.name,
          input.address,
          input.city,
          input.timeZone,
          input.amenities,
          input.accessibility,
        ],
      );
      await this.audit.record(tx, actor, "venue.created", id, {
        organizationId: org,
      });
      return { id };
    });
  }
  space(actor: string, org: string, venue: string, input: SpaceInput) {
    return transaction(async (tx) => {
      await this.access.requireMember(actor, org, true, tx);
      const parent = (
        await tx.query(
          "SELECT id FROM venues.venues WHERE id=$1 AND organization_id=$2 FOR SHARE",
          [venue, org],
        )
      ).rows[0];
      if (!parent) throw new AppError("NOT_FOUND", "Venue not found.", 404);
      const id = randomUUID();
      const r = await tx.query(
        "INSERT INTO venues.spaces(id,venue_id,name,kind,physical_capacity,turnaround_minutes) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(venue_id,name) DO NOTHING RETURNING id",
        [
          id,
          venue,
          input.name,
          input.kind,
          input.physicalCapacity,
          input.turnaroundMinutes,
        ],
      );
      if (!r.rowCount)
        throw new AppError(
          "SPACE_EXISTS",
          "This venue already has a space with that name.",
          409,
        );
      await this.audit.record(tx, actor, "space.created", id, {
        organizationId: org,
      });
      return { id };
    });
  }
  plan(
    actor: string,
    org: string,
    space: string,
    input: { label: string; expectedVersion: number; configuration: Plan },
  ) {
    return transaction(async (tx) => {
      await this.access.requireMember(actor, org, true, tx);
      const row = (
        await tx.query(
          "SELECT s.* FROM venues.spaces s JOIN venues.venues v ON v.id=s.venue_id WHERE s.id=$1 AND v.organization_id=$2 FOR UPDATE OF s",
          [space, org],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Space not found.", 404);
      if (row.version !== input.expectedVersion)
        throw new AppError(
          "VERSION_CONFLICT",
          "Another plan was saved. Refresh and review the latest version.",
          409,
        );
      validatePlan(input.configuration, row.physical_capacity);
      const id = randomUUID();
      await tx.query(
        "INSERT INTO venues.plans(id,space_id,version,label,configuration) VALUES($1,$2,$3,$4,$5)",
        [id, space, row.version, input.label, input.configuration],
      );
      await tx.query("UPDATE venues.spaces SET version=version+1 WHERE id=$1", [
        space,
      ]);
      await this.audit.record(tx, actor, "plan.version_created", id, {
        organizationId: org,
        spaceId: space,
        version: row.version,
      });
      return { id, version: row.version };
    });
  }
  async lockForSchedule(
    tx: Transaction,
    organizationId: string,
    planId: string,
  ): Promise<ScheduledPlan> {
    const r = (
      await tx.query(
        "SELECT p.id,p.version,p.configuration,s.id space_id,s.name space_name,s.turnaround_minutes,v.id venue_id,v.name venue_name,v.address,v.city,v.time_zone,v.amenities,v.accessibility FROM venues.plans p JOIN venues.spaces s ON s.id=p.space_id JOIN venues.venues v ON v.id=s.venue_id WHERE p.id=$1 AND v.organization_id=$2 FOR UPDATE OF s",
        [planId, organizationId],
      )
    ).rows[0];
    if (!r)
      throw new AppError(
        "NOT_FOUND",
        "Seating plan not found in this organization.",
        404,
      );
    return {
      id: r.id,
      version: r.version,
      configuration: r.configuration,
      spaceId: r.space_id,
      spaceName: r.space_name,
      turnaroundMinutes: r.turnaround_minutes,
      venueId: r.venue_id,
      venueName: r.venue_name,
      address: r.address,
      city: r.city,
      timeZone: r.time_zone,
      amenities: r.amenities,
      accessibility: r.accessibility,
    };
  }
}
