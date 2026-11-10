import { transaction, type Transaction } from "../../../shared/database.ts";
import {
  pageScope,
  readPage,
  nextPage,
} from "../../../shared/admin-pagination.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  PaymentAdminStore,
  PaymentFilters,
} from "../application/administration.ts";
export class PostgresPaymentAdministration implements PaymentAdminStore {
  run<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(async (tx) => {
      await tx.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      return work(tx);
    });
  }
  async exceptions(tx: Transaction, actor: string, after?: string) {
    const scope = pageScope(actor, ["provider-order-exceptions"]),
      cursor = readPage(after, scope);
    const rows = (
      await tx.query(
        `SELECT order_id AS id,provider_id,state,amount_paise::text,created_at,checked_at,failures,last_error_code,review_required,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM payments.provider_orders WHERE (review_required OR state IN ('unknown','failed') OR last_error_code IS NOT NULL) AND ($1::timestamptz IS NULL OR (created_at,order_id)<($1,$2::uuid)) ORDER BY created_at DESC,order_id DESC LIMIT 26`,
        [cursor?.time ?? null, cursor?.id ?? null],
      )
    ).rows;
    return {
      items: rows.slice(0, 25).map(({ page_time, ...r }) => r),
      nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async list(
    tx: Transaction,
    actor: string,
    f: PaymentFilters,
    exporting = false,
  ) {
    const { after, ...selection } = f,
      scope = pageScope(actor, ["finance-attempts", selection]),
      cursor = readPage(after, scope);
    const rows = (
      await tx.query(
        `SELECT a.timeline_id AS id,a.provider_payment_id AS transaction_id,a.order_id AS booking_id,'razorpay' AS provider,a.method,a.state,a.amount_paise::text,a.currency,a.amount_refunded_paise::text,a.error_code,a.error_reason,a.observed_at AS created_at,p.review_required,p.last_error_code,to_char(a.observed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time
 FROM payments.attempts a JOIN payments.provider_orders p ON p.order_id=a.order_id
 WHERE ($1::uuid IS NULL OR a.order_id=$1) AND ($2::text IS NULL OR a.provider_payment_id=$2 OR a.timeline_id::text=$2) AND ($3::text IS NULL OR a.method=$3) AND ($4::text IS NULL OR a.state=$4) AND ($5::timestamptz IS NULL OR a.observed_at >=$5) AND ($6::timestamptz IS NULL OR a.observed_at <$6) AND ($7::text IS NULL OR p.review_required OR p.state IN ('failed','unknown') OR p.last_error_code IS NOT NULL) AND ($8::timestamptz IS NULL OR (a.observed_at,a.timeline_id)<($8,$9::uuid)) ORDER BY a.observed_at DESC,a.timeline_id DESC LIMIT $10`,
        [
          f.booking ?? null,
          f.transaction ?? null,
          f.method ?? null,
          f.state ?? null,
          f.from ?? null,
          f.until ?? null,
          f.exception ?? null,
          cursor?.time ?? null,
          cursor?.id ?? null,
          exporting ? 5001 : 26,
        ],
      )
    ).rows;
    return {
      items: rows
        .slice(0, exporting ? 5001 : 25)
        .map(({ page_time, ...r }) => r),
      nextCursor:
        !exporting && rows.length > 25 ? nextPage(rows[24], scope) : null,
    };
  }
  async detail(tx: Transaction, actor: string, id: string, after?: string) {
    const a = (
      await tx.query(
        "SELECT timeline_id AS id,provider_payment_id AS transaction_id,order_id AS booking_id,'razorpay' AS provider,method,state,amount_paise::text,currency,amount_refunded_paise::text,error_code,error_reason,observed_at FROM payments.attempts WHERE timeline_id=$1",
        [id],
      )
    ).rows[0];
    if (!a) throw new AppError("NOT_FOUND", "Payment attempt not found.", 404);
    const scope = pageScope(actor, ["attempt-observations", id]),
      cursor = readPage(after, scope);
    const rows = (
      await tx.query(
        `SELECT id,previous_state,state,amount_paise::text,method,error_code,error_reason,amount_refunded_paise::text,recorded_at,to_char(recorded_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS page_time FROM payments.attempt_observations WHERE attempt_id=$1 AND ($2::timestamptz IS NULL OR (recorded_at,id)<($2,$3::uuid)) ORDER BY recorded_at DESC,id DESC LIMIT 26`,
        [id, cursor?.time ?? null, cursor?.id ?? null],
      )
    ).rows;
    const capture =
        (
          await tx.query(
            "SELECT amount_paise::text,currency,captured_at FROM payments.captures WHERE provider_payment_id=$1",
            [a.transaction_id],
          )
        ).rows[0] ?? null,
      recovery =
        (
          await tx.query(
            "SELECT id,state,reason,amount_paise::text,created_at FROM payments.recovery WHERE provider_payment_id=$1",
            [a.transaction_id],
          )
        ).rows[0] ?? null,
      reconciliation = (
        await tx.query(
          "SELECT state,provider_id,checked_at,available_at,failures,last_error_code,review_required,lease_until>clock_timestamp() AS in_progress FROM payments.provider_orders WHERE order_id=$1",
          [a.booking_id],
        )
      ).rows[0];
    return {
      attempt: a,
      capture,
      recovery,
      reconciliation,
      history: {
        items: rows.slice(0, 25).map(({ page_time, ...r }) => r),
        nextCursor: rows.length > 25 ? nextPage(rows[24], scope) : null,
      },
    };
  }
}
