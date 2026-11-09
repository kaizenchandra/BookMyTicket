import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { PublicVenueSessions } from "../contracts/index.ts";
export class PostgresVenueSessions implements PublicVenueSessions {
  async read(venueId: string, organizationId: string, after?: string) {
    const scope = createHash("sha256")
      .update(JSON.stringify([venueId, organizationId]))
      .digest("hex");
    let cursor: { id: string; time: string; scope: string } | undefined;
    if (after)
      try {
        cursor = z
          .object({
            id: z.uuid(),
            time: z.iso.datetime(),
            scope: z.string().length(64),
          })
          .strict()
          .parse(JSON.parse(Buffer.from(after, "base64url").toString()));
        if (cursor.scope !== scope) throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Return to the first venue page.",
          422,
        );
      }
    const visible = await pool.query(
      `SELECT 1 FROM catalog.session_projection s JOIN catalog.listings l ON l.id=s.listing_id
      WHERE s.venue_id=$1 AND l.organization_id=$2 AND l.state='published' LIMIT 1`,
      [venueId, organizationId],
    );
    if (!visible.rowCount)
      return { visible: false, items: [], nextCursor: null };
    const { rows } = await pool.query(
      `SELECT s.occurrence_id AS id,l.id AS "listingId",l.title,l.kind,s.starts_at AS "startsAt",s.time_zone AS "timeZone",s.venue_name AS "spaceName",
      to_char(s.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
      FROM catalog.session_projection s JOIN catalog.listings l ON l.id=s.listing_id
      WHERE s.venue_id=$1 AND l.organization_id=$2 AND l.state='published' AND s.state='open' AND s.starts_at>statement_timestamp()
      AND ($3::timestamptz IS NULL OR (s.starts_at,s.occurrence_id)>($3::timestamptz,$4::uuid))
      ORDER BY s.starts_at,s.occurrence_id LIMIT 21`,
      [venueId, organizationId, cursor?.time ?? null, cursor?.id ?? null],
    );
    const items = rows.slice(0, 20),
      last = items[19];
    return {
      visible: true,
      items: items.map(({ page_time, startsAt, ...item }) => ({
        ...item,
        startsAt: startsAt.toISOString(),
      })),
      nextCursor:
        rows.length > 20
          ? Buffer.from(
              JSON.stringify({ id: last.id, time: last.page_time, scope }),
            ).toString("base64url")
          : null,
    };
  }
}
