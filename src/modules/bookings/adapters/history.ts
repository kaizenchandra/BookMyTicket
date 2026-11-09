import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { HistoryFilters, HistoryPort } from "../application/history.ts";
const cursorSchema = z
  .object({
    id: z.uuid(),
    time: z.iso.datetime(),
    scope: z.string().length(64),
  })
  .strict();
export class PostgresHistory implements HistoryPort {
  async search(owner: string, f: HistoryFilters) {
    const normalized = [
      owner,
      f.q?.toLowerCase() ?? null,
      f.state ?? null,
      f.period ?? null,
      f.from ? new Date(f.from).toISOString() : null,
      f.until ? new Date(f.until).toISOString() : null,
    ];
    const scope = createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex");
    let cursor: z.infer<typeof cursorSchema> | undefined;
    if (f.after)
      try {
        cursor = cursorSchema.parse(
          JSON.parse(Buffer.from(f.after, "base64url").toString()),
        );
        if (cursor.scope !== scope) throw new Error();
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Your account or filters changed. Return to the first page.",
          422,
        );
      }
    const rows = await pool.query(
      `
   SELECT id,amount_paise,currency,state,created_at,confirmed_at,
     COALESCE(snapshot->'occurrences','[]'::jsonb) AS occurrences,
     to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time,
     clock_timestamp() AS server_time
   FROM bookings.orders
   WHERE owner_id=$1 AND ($2::text IS NULL OR id::text ILIKE '%'||$2||'%' OR EXISTS(
     SELECT 1 FROM jsonb_array_elements(COALESCE(snapshot->'occurrences','[]'::jsonb)) o WHERE o->>'title' ILIKE '%'||$2||'%'
   ))
   AND ($3::text IS NULL OR state=$3)
   AND ($4::text IS NULL OR (state='confirmed' AND EXISTS(
     SELECT 1 FROM jsonb_array_elements(COALESCE(snapshot->'occurrences','[]'::jsonb)) o WHERE o->>'endsAt' IS NOT NULL
   ) AND CASE WHEN $4='upcoming' THEN EXISTS(
     SELECT 1 FROM jsonb_array_elements(COALESCE(snapshot->'occurrences','[]'::jsonb)) o WHERE (o->>'endsAt')::timestamptz>statement_timestamp()
   ) ELSE NOT EXISTS(
     SELECT 1 FROM jsonb_array_elements(COALESCE(snapshot->'occurrences','[]'::jsonb)) o WHERE o->>'endsAt' IS NULL OR (o->>'endsAt')::timestamptz>statement_timestamp()
   ) END))
   AND ($5::timestamptz IS NULL OR created_at >= $5)
   AND ($6::timestamptz IS NULL OR created_at < $6)
   AND ($7::timestamptz IS NULL OR (created_at,id)<($7::timestamptz,$8::uuid))
   ORDER BY created_at DESC,id DESC LIMIT 26`,
      [
        owner,
        normalized[1]?.replace(/[\\%_]/g, "\\$&") ?? null,
        ...normalized.slice(2),
        cursor?.time ?? null,
        cursor?.id ?? null,
      ],
    );
    const items = rows.rows.slice(0, 25),
      last = items[24];
    return {
      items: items.map(({ page_time, server_time, ...item }) => item),
      nextCursor:
        rows.rows.length > 25
          ? Buffer.from(
              JSON.stringify({ id: last.id, time: last.page_time, scope }),
            ).toString("base64url")
          : null,
      serverTime:
        rows.rows[0]?.server_time ??
        (await pool.query("SELECT clock_timestamp() now")).rows[0].now,
    };
  }
}
