import { randomUUID } from "node:crypto";
import {
  pool,
  transaction,
  type Transaction,
} from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { QuoteStore } from "../application/quotes.ts";
import type { Quote } from "../contracts/index.ts";
import type { ReservedSnapshot } from "../../inventory/contracts/index.ts";
import type { CommercialPolicy, PriceBreakdown } from "../domain/quote.ts";
export class PostgresQuotes implements QuoteStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>) {
    return transaction(work);
  }
  async policy(tx: Transaction, occurrenceId: string) {
    const row = (
      await tx.query(
        "SELECT p.id,p.label,p.configuration FROM pricing.assignments a JOIN pricing.policies p ON p.id=a.policy_id WHERE a.occurrence_id=$1 FOR SHARE OF a",
        [occurrenceId],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        "COMMERCIAL_POLICY_UNAVAILABLE",
        "This occurrence has no approved commercial policy. Checkout is unavailable.",
        503,
      );
    return row;
  }
  private map(row: any): Quote {
    return {
      ...row.snapshot,
      id: row.id,
      ownerId: row.owner_id,
      reservationId: row.reservation_id,
      policyId: row.policy_id,
      expiresAt: row.expires_at.toISOString(),
      serverTime: row.server_time.toISOString(),
      version: 1,
    };
  }
  async find(tx: Transaction, ownerId: string, id: string) {
    const row = (
      await tx.query(
        "SELECT *,clock_timestamp() server_time,expires_at>clock_timestamp() fresh FROM pricing.quotes WHERE id=$1 AND owner_id=$2",
        [id, ownerId],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Quote not found.", 404);
    if (!row.fresh)
      throw new AppError(
        "QUOTE_EXPIRED",
        "The quote expired. Reserve your selection again.",
        409,
      );
    return this.map(row);
  }
  async persist(
    tx: Transaction,
    ownerId: string,
    snapshot: ReservedSnapshot,
    policy: { id: string; label: string; configuration: CommercialPolicy },
    prices: PriceBreakdown,
  ) {
    const row = (
      await tx.query(
        "INSERT INTO pricing.quotes(id,owner_id,reservation_id,policy_id,amount_paise,currency,snapshot,expires_at) VALUES($1,$2,$3,$4,$5,'INR',$6,$7) ON CONFLICT(reservation_id,policy_id) DO NOTHING RETURNING id",
        [
          randomUUID(),
          ownerId,
          snapshot.id,
          policy.id,
          prices.totalPaise,
          {
            policyLabel: policy.label,
            policy: policy.configuration,
            prices,
            reservationSnapshot: snapshot,
          },
          snapshot.expires_at,
        ],
      )
    ).rows[0];
    const id =
      row?.id ??
      (
        await tx.query(
          "SELECT id FROM pricing.quotes WHERE reservation_id=$1 AND policy_id=$2",
          [snapshot.id, policy.id],
        )
      ).rows[0].id;
    return this.find(tx, ownerId, id);
  }
}
