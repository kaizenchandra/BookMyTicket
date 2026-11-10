import type {
  DashboardSource,
  DashboardPeriod,
} from "../../../shared/dashboard.ts";
import type { Transaction } from "../../../shared/database.ts";
export class PaymentDashboard implements DashboardSource {
  async read(tx: Transaction, period: DashboardPeriod) {
    const args = [period.from, period.until, period.bookingIds ?? null];
    const captures = await tx.query(
      `SELECT count(*)::text AS captures,coalesce(sum(amount_paise),0)::text AS captured_paise FROM payments.captures WHERE captured_at >= $1 AND captured_at < $2 AND ($3::uuid[] IS NULL OR order_id=ANY($3))`,
      args,
    );
    const recovery = await tx.query(
      `SELECT state,count(*)::text AS cases,coalesce(sum(amount_paise),0)::text AS amount_paise FROM payments.recovery WHERE created_at >= $1 AND created_at < $2 AND ($3::uuid[] IS NULL OR order_id=ANY($3)) GROUP BY state ORDER BY state`,
      args,
    );
    const refunded = await tx.query(
      `SELECT count(*)::text AS provider_refunded_attempts FROM payments.attempts WHERE state='refunded' AND observed_at >= $1 AND observed_at < $2 AND ($3::uuid[] IS NULL OR order_id=ANY($3))`,
      args,
    );
    const failures = await tx.query(
      `SELECT count(*)::text AS failed_attempts FROM payments.attempts WHERE state='failed' AND observed_at >= $1 AND observed_at < $2 AND ($3::uuid[] IS NULL OR order_id=ANY($3))`,
      args,
    );
    const exceptions = await tx.query(
      `SELECT count(*)::text AS payment_exceptions FROM payments.provider_orders WHERE (state IN ('failed','unknown') OR review_required) AND created_at >= $1 AND created_at < $2 AND ($3::uuid[] IS NULL OR order_id=ANY($3))`,
      args,
    );
    return {
      ...failures.rows[0],
      ...exceptions.rows[0],
      ...captures.rows[0],
      ...refunded.rows[0],
      recovery: recovery.rows,
    };
  }
}
