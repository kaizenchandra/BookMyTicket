import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { ProviderReviewPort } from "../application/review.ts";
export class PostgresProviderReview implements ProviderReviewPort {
  async queue() {
    return (
      await pool.query(
        "SELECT id,name,kind,state,version FROM providers.organizations WHERE state='submitted' ORDER BY created_at LIMIT 100",
      )
    ).rows;
  }
  async review(
    id: string,
    version: number,
    state: "approved" | "changes_requested" | "rejected",
    reason: string,
    actorId: string,
  ) {
    return transaction(async (tx) => {
      const result = await tx.query(
        "UPDATE providers.organizations SET state=$3,reason=$4,version=version+1 WHERE id=$1 AND version=$2 AND state='submitted' AND owner_id<>$5 RETURNING id,name,state,version",
        [id, version, state, reason, actorId],
      );
      if (!result.rowCount)
        throw new AppError(
          "CONFLICT",
          "Organization state/version changed, or self-review is prohibited.",
        );
      return result.rows[0];
    });
  }
}
