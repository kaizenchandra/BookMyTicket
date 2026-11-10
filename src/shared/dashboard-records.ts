import type { Transaction } from "./database.ts";
import { readPage, nextPage } from "./admin-pagination.ts";
import type { DashboardRecord } from "./dashboard.ts";
export async function dashboardRecords(
  tx: Transaction,
  query: string,
  values: unknown[],
  after: string | undefined,
  scope: string,
) {
  const cursor = readPage(after, scope),
    n = values.length;
  const result = await tx.query(
    `WITH records AS (${query}) SELECT *,to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM records WHERE ($${n + 1}::timestamptz IS NULL OR (at,id)<($${n + 1},$${n + 2}::uuid)) ORDER BY at DESC,id DESC LIMIT 26`,
    [...values, cursor?.time ?? null, cursor?.id ?? null],
  );
  return {
    items: result.rows
      .slice(0, 25)
      .map(({ page_time, ...r }) => r) as DashboardRecord[],
    nextCursor:
      result.rows.length > 25 ? nextPage(result.rows[24], scope) : null,
  };
}
