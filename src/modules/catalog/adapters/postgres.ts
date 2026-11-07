import { createHash } from "node:crypto";
import { z } from "zod";
import { pool, type Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { CatalogPort, CatalogFilters } from "../application/catalog.ts";
export class PostgresCatalog implements CatalogPort {
  async recordSession(
    tx: Transaction,
    input: {
      id: string;
      listingId: string;
      startsAt: string;
      timeZone: string;
      venueName: string;
      state: string;
    },
  ) {
    await tx.query(
      "INSERT INTO catalog.session_projection(occurrence_id,listing_id,starts_at,time_zone,venue_name,state) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(occurrence_id) DO UPDATE SET starts_at=$3,time_zone=$4,venue_name=$5,state=$6",
      [
        input.id,
        input.listingId,
        input.startsAt,
        input.timeZone,
        input.venueName,
        input.state,
      ],
    );
  }
  async search(f: CatalogFilters) {
    const sort = f.sort ?? "newest",
      normalized = [
        f.city?.trim().toLowerCase() || null,
        f.kind || null,
        f.q?.trim().toLowerCase() || null,
        f.language?.trim().toLowerCase() || null,
        f.genre?.trim().toLowerCase() || null,
        f.format?.trim().toLowerCase() || null,
      ];
    const scope = createHash("sha256")
      .update(JSON.stringify([sort, ...normalized, f.upcoming ?? false]))
      .digest("hex");
    let cursor: { id: string; key: string; scope: string } | null = null;
    if (f.after) {
      try {
        cursor = z
          .object({ id: z.uuid(), key: z.string().max(200), scope: z.string() })
          .strict()
          .parse(JSON.parse(Buffer.from(f.after, "base64url").toString()));
        if (cursor.scope !== scope) throw new Error();
        if (sort === "newest") z.iso.datetime().parse(cursor.key);
      } catch {
        throw new AppError(
          "INVALID_CURSOR",
          "Filters changed or this page link is invalid. Return to the first page.",
          422,
        );
      }
    }
    const parameters = [
      normalized[0],
      normalized[1],
      normalized[2]?.replace(/[\\%_]/g, "\\$&") ?? null,
      ...normalized.slice(3),
    ];
    const base =
      (f.upcoming
        ? "EXISTS(SELECT 1 FROM catalog.session_projection sp WHERE sp.listing_id=catalog.listings.id AND sp.state='open' AND sp.starts_at>clock_timestamp()) AND "
        : "") +
      "state='published' AND ($1::text IS NULL OR lower(btrim(city))=$1) AND ($2::text IS NULL OR kind=$2) AND ($3::text IS NULL OR title ILIKE '%'||$3||'%')";
    const filters =
      " AND ($4::text IS NULL OR lower(metadata->>'language')=$4) AND ($5::text IS NULL OR lower(metadata->>'genre')=$5) AND ($6::text IS NULL OR lower(metadata->>'format')=$6)";
    const ordering =
      sort === "title" ? "lower(title),id" : "created_at DESC,id DESC";
    const page =
      sort === "title"
        ? "($7::text IS NULL OR (lower(title),id)>($7,$8::uuid))"
        : "($7::timestamptz IS NULL OR (created_at,id)<($7::timestamptz,$8::uuid))";
    const [rows, count, options] = await Promise.all([
      pool.query(
        `SELECT id,title,kind,city,description,poster_url,metadata,version,lower(title) AS title_key,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS time_key FROM catalog.listings WHERE ${base}${filters} AND ${page} ORDER BY ${ordering} LIMIT 25`,
        [...parameters, cursor?.key ?? null, cursor?.id ?? null],
      ),
      pool.query(
        `SELECT count(*)::int total FROM catalog.listings WHERE ${base}${filters}`,
        parameters,
      ),
      pool.query(
        `SELECT DISTINCT facet.key,facet.value FROM catalog.listings CROSS JOIN LATERAL jsonb_each_text(metadata) facet WHERE ${base} AND facet.key IN ('language','genre','format') AND btrim(facet.value)<>'' AND ($4::text IS NULL OR facet.key='language' OR lower(metadata->>'language')=$4) AND ($5::text IS NULL OR facet.key='genre' OR lower(metadata->>'genre')=$5) AND ($6::text IS NULL OR facet.key='format' OR lower(metadata->>'format')=$6) ORDER BY facet.key,facet.value LIMIT 300`,
        parameters,
      ),
    ]);
    const last = rows.rows[23],
      facets: Record<string, string[]> = {
        language: [],
        genre: [],
        format: [],
      };
    for (const option of options.rows) facets[option.key].push(option.value);
    const projected = await pool.query(
      `SELECT DISTINCT ON (listing_id) listing_id, starts_at AS "startsAt",time_zone AS "timeZone",venue_name AS "venueName" FROM catalog.session_projection WHERE listing_id=ANY($1::uuid[]) AND state='open' AND starts_at>clock_timestamp() ORDER BY listing_id,starts_at,occurrence_id`,
      [rows.rows.slice(0, 24).map((r) => r.id)],
    );
    const sessions = new Map(
      projected.rows.map(({ listing_id, ...session }) => [listing_id, session]),
    );
    return {
      items: rows.rows
        .slice(0, 24)
        .map(({ title_key, time_key, ...item }) => ({
          ...item,
          nextSession: sessions.get(item.id) ?? null,
        })),
      total: count.rows[0].total,
      facets,
      nextCursor:
        rows.rows.length === 25
          ? Buffer.from(
              JSON.stringify({
                id: last.id,
                key: sort === "title" ? last.title_key : last.time_key,
                scope,
              }),
            ).toString("base64url")
          : null,
      serverTime: new Date().toISOString(),
    };
  }
  async suggestions(q: string, city?: string) {
    const pattern = q.trim().replace(/[\\%_]/g, "\\$&");
    const result = await pool.query(
      "SELECT id,title,kind,city,metadata->>'language' AS language FROM (SELECT *,row_number() OVER(PARTITION BY kind ORDER BY lower(title),id) AS rank FROM catalog.listings WHERE state='published' AND title ILIKE '%'||$1||'%' AND ($2::text IS NULL OR lower(btrim(city))=lower($2))) matches WHERE rank<=4 ORDER BY kind,lower(title),id",
      [pattern, city?.trim() || null],
    );
    return {
      groups: ["movie", "event", "sports"]
        .map((kind) => ({
          kind,
          items: result.rows.filter((r) => r.kind === kind),
        }))
        .filter((g) => g.items.length),
      serverTime: new Date().toISOString(),
    };
  }
  async detail(id: string) {
    const r = await pool.query(
      "SELECT id,title,kind,city,description,poster_url,metadata,version FROM catalog.listings WHERE id=$1 AND state='published'",
      [id],
    );
    if (!r.rowCount)
      throw new AppError("NOT_FOUND", "This listing is not available.", 404);
    return r.rows[0];
  }
  async requireOwnedPublished(
    id: string,
    organizationId: string,
    tx?: Transaction,
  ) {
    const r = await (tx ?? pool).query(
      "SELECT 1 FROM catalog.listings WHERE id=$1 AND organization_id=$2 AND state='published'" +
        (tx ? " FOR SHARE" : ""),
      [id, organizationId],
    );
    if (!r.rowCount)
      throw new AppError(
        "FORBIDDEN",
        "Listing does not belong to this approved scope.",
        403,
      );
  }
  async requirePublished(id: string, tx?: Transaction) {
    const result = await (tx ?? pool).query(
      "SELECT 1 FROM catalog.listings WHERE id=$1 AND state='published'" +
        (tx ? " FOR SHARE" : ""),
      [id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "This listing is not available.", 404);
  }
  async summaries(ids: string[]) {
    return (
      await pool.query(
        "SELECT id,title,kind,city,poster_url FROM catalog.listings WHERE id=ANY($1::uuid[]) AND state='published'",
        [ids],
      )
    ).rows;
  }
  async cities() {
    return (
      await pool.query(
        "SELECT DISTINCT city FROM catalog.listings WHERE state='published' ORDER BY city",
      )
    ).rows.map((r) => r.city);
  }
}
