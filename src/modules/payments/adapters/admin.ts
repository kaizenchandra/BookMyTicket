import { transaction } from "../../../shared/database.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import { z } from "zod";
export const financeRecordFilters = z
  .object({
    booking: z.uuid().optional(),
    after: z.string().max(1500).optional(),
  })
  .strict();
export class AdminPaymentRecords {
  constructor(
    private access: StaffAuthorization,
    private audit: SecurityAudit,
  ) {}
  list(
    actor: string,
    recovery: boolean,
    f: { booking?: string; after?: string },
  ) {
    return transaction(async (tx) => {
      await this.access.requirePermission(tx, actor, "finance");
      const scope = pageScope(actor, [recovery, f.booking ?? null]),
        cursor = readPage(f.after, scope);
      const result = await tx.query(
        recovery
          ? `SELECT id,order_id AS booking_id,state,amount_paise::text,created_at,
    to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
    FROM payments.recovery WHERE ($1::uuid IS NULL OR order_id=$1) AND ($2::timestamptz IS NULL OR (created_at,id)<($2,$3::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`
          : `SELECT timeline_id AS id,order_id AS booking_id,state,amount_paise::text,observed_at AS created_at,
    to_char(observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
    FROM payments.attempts WHERE ($1::uuid IS NULL OR order_id=$1) AND ($2::timestamptz IS NULL OR (observed_at,timeline_id)<($2,$3::uuid)) ORDER BY observed_at DESC,timeline_id DESC LIMIT 26`,
        [f.booking ?? null, cursor?.time ?? null, cursor?.id ?? null],
      );
      await this.audit.record(
        tx,
        actor,
        "payments.admin.read",
        recovery ? "recovery" : "attempts",
        { outcome: "success" },
      );
      return {
        items: result.rows.slice(0, 25).map(({ page_time, ...r }) => r),
        nextCursor:
          result.rows.length > 25 ? nextPage(result.rows[24], scope) : null,
      };
    });
  }
}
