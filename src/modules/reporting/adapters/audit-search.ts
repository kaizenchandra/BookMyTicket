import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  AuditFilters,
  AuditSearchPort,
} from "../application/audit-search.ts";

const integer = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
const cursorSchema = z
  .object({ before: integer, ceiling: integer, scope: z.string().length(64) })
  .strict();
export class PostgresAuditSearch implements AuditSearchPort {
  async search(actor: string, f: AuditFilters) {
    const values = [
      f.actor ?? null,
      f.action ?? null,
      f.target ?? null,
      f.from ? new Date(f.from).toISOString() : null,
      f.until ? new Date(f.until).toISOString() : null,
    ];
    const scope = createHash("sha256")
      .update(JSON.stringify([actor, ...values]))
      .digest("hex");
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (f.after) {
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(f.after, "base64url").toString()),
        );
        if (
          cursor.scope !== scope ||
          BigInt(cursor.before) > BigInt(cursor.ceiling)
        )
          throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Filters or account changed. Return to the first page.",
          422,
        );
      }
    }
    const result = await pool.query(
      `
      WITH boundary AS (
        SELECT COALESCE($6::bigint,(SELECT max(id) FROM reporting.audit),0) AS ceiling,
          clock_timestamp() AS server_time
      ), page AS (
        SELECT a.id::text,a.actor_id,a.action,a.target,a.created_at,
          CASE WHEN a.details->>'outcome' IN ('success','failure','denied') THEN a.details->>'outcome' ELSE 'not_recorded' END AS outcome
        FROM reporting.audit a, boundary b
        WHERE a.id<=b.ceiling AND ($7::bigint IS NULL OR a.id<$7)
          AND ($1::uuid IS NULL OR a.actor_id=$1)
          AND ($2::text IS NULL OR a.action=$2)
          AND ($3::text IS NULL OR a.target=$3)
          AND ($4::timestamptz IS NULL OR a.created_at >= $4)
          AND ($5::timestamptz IS NULL OR a.created_at < $5)
        ORDER BY a.id DESC LIMIT 51
      )
      SELECT b.ceiling::text,b.server_time,
        COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM page p),'[]'::jsonb) AS items
      FROM boundary b`,
      [...values, cursor?.ceiling ?? null, cursor?.before ?? null],
    );
    const row = result.rows[0],
      items = row.items.slice(0, 50);
    return {
      items,
      nextCursor:
        row.items.length > 50
          ? Buffer.from(
              JSON.stringify({
                before: items[49].id,
                ceiling: row.ceiling,
                scope,
              }),
            ).toString("base64url")
          : null,
      serverTime: row.server_time,
    };
  }
}
