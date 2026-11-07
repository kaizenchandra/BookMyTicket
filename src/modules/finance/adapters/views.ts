import { pool } from "../../../shared/database.ts";
export class FinanceViews {
  async journals() {
    return (
      await pool.query(
        "SELECT j.id,j.event_id,j.created_at,json_agg(json_build_object('account',l.account,'amountPaise',l.amount_paise,'currency',l.currency)) lines FROM finance.journals j JOIN finance.lines l ON l.journal_id=j.id GROUP BY j.id ORDER BY j.created_at DESC LIMIT 100",
      )
    ).rows;
  }
}
