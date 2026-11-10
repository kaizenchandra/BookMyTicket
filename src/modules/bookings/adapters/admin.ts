import { transaction, type Transaction } from "../../../shared/database.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  AdminBookingStore,
  AdminBookingFilters,
} from "../application/admin.ts";
export class PostgresAdminBookings implements AdminBookingStore {
  transaction<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      return work(tx);
    });
  }
  async list(tx: Transaction, actor: string, f: AdminBookingFilters) {
    const values = [
      f.id ?? null,
      f.customer ?? null,
      f.state ?? null,
      f.from ?? null,
      f.until ?? null,
      f.confirmed ?? null,
    ];
    const scope = pageScope(actor, [
        values,
        f.product,
        f.supplier,
        f.travelFrom,
        f.travelUntil,
        f.pnr,
        f.exception,
        f.assignedTo,
      ]),
      cursor = readPage(f.after, scope);
    const result = await tx.query(
      `SELECT id,owner_id AS customer_id,state,amount_paise::text,currency,created_at,confirmed_at,
   coalesce(snapshot->'occurrences'->0->>'title','Booking') AS title,
   to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
   FROM bookings.orders o WHERE ($1::uuid IS NULL OR id=$1) AND ($2::uuid IS NULL OR owner_id=$2) AND ($3::text IS NULL OR state=$3)
   AND ($4::timestamptz IS NULL OR created_at >= $4) AND ($5::timestamptz IS NULL OR created_at < $5)
   AND ($6::text IS NULL OR confirmed_at IS NOT NULL)
   AND ($9::text[] IS NULL OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) occ WHERE occ->>'listingId'=ANY($9)))
   AND (($10::timestamptz IS NULL AND $11::timestamptz IS NULL) OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) occ WHERE ($10::timestamptz IS NULL OR (occ->>'startsAt')::timestamptz >=$10) AND ($11::timestamptz IS NULL OR (occ->>'startsAt')::timestamptz <$11)))
   AND ($12::text IS NULL OR false)
   AND ($13::text IS NULL OR ($13='stalled' AND state='pending_payment' AND created_at<now()-interval '30 minutes') OR ($13='refund_required' AND state='refund_required') OR EXISTS(SELECT 1 FROM bookings.admin_exceptions e WHERE e.order_id=o.id AND e.state=$13))
   AND ($14::uuid IS NULL OR EXISTS(SELECT 1 FROM bookings.admin_exceptions e WHERE e.order_id=o.id AND e.assigned_to=$14))
   AND ($7::timestamptz IS NULL OR (created_at,id)<($7,$8::uuid)) ORDER BY created_at DESC,id DESC LIMIT 26`,
      [
        ...values,
        cursor?.time ?? null,
        cursor?.id ?? null,
        f.listingIds ?? null,
        f.travelFrom ?? null,
        f.travelUntil ?? null,
        f.pnr ?? null,
        f.exception ?? null,
        f.assignedTo ?? null,
      ],
    );
    return {
      items: result.rows.slice(0, 25).map(({ page_time, ...r }) => r),
      nextCursor:
        result.rows.length > 25 ? nextPage(result.rows[24], scope) : null,
    };
  }
  async detail(tx: Transaction, id: string) {
    const result = await tx.query(
      `SELECT id,owner_id AS customer_id,state,amount_paise::text,currency,created_at,accepted_at,confirmed_at,policy_version,
   (SELECT coalesce(jsonb_agg(jsonb_build_object('id',o->>'id','title',o->>'title','venueName',o->>'venueName','startsAt',o->>'startsAt','endsAt',o->>'endsAt','timeZone',o->>'timeZone','isDemo',o->'isDemo')),'[]') FROM jsonb_array_elements(coalesce(snapshot->'occurrences','[]')) o) AS occurrences
   FROM bookings.orders WHERE id=$1`,
      [id],
    );
    if (!result.rowCount)
      throw new AppError("NOT_FOUND", "Booking not found.", 404);
    const cancellations = await tx.query(
      `SELECT 'pending_cancelled' AS kind,created_at AS at FROM bookings.pending_cancellations WHERE order_id=$1 UNION ALL SELECT 'free_cancelled',created_at FROM bookings.free_cancellations WHERE order_id=$1 ORDER BY at`,
      [id],
    );
    const row = result.rows[0];
    const timeline = [
      { kind: "created", at: row.created_at },
      ...(row.accepted_at
        ? [{ kind: "policies_accepted", at: row.accepted_at }]
        : []),
      ...(row.confirmed_at
        ? [{ kind: "confirmed", at: row.confirmed_at }]
        : []),
      ...cancellations.rows,
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return {
      ...row,
      timeline,
      supplierConfirmation: {
        state: "not_applicable",
        pnr: null,
        message:
          "These are platform-issued admission bookings. Travel supplier bookings are not connected.",
      },
    };
  }
}
