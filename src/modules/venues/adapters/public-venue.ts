import { pool } from "../../../shared/database.ts";
import type { PublicVenueStore } from "../application/public-venue.ts";
export class PostgresPublicVenue implements PublicVenueStore {
  async find(id: string) {
    const { rows } = await pool.query(
      `SELECT media,id,organization_id AS "organizationId",name,address,city,time_zone AS "timeZone",amenities,accessibility,transport_guidance AS "transportGuidance",parking_guidance AS "parkingGuidance",entry_policies AS "entryPolicies",CASE WHEN contact_public THEN json_build_object('phone',contact_phone,'email',contact_email) ELSE NULL END AS contact FROM venues.venues WHERE id=$1`,
      [id],
    );
    return rows[0] ?? null;
  }
}
