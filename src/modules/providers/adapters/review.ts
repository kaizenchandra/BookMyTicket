import { requireCompleteOnboarding } from "../domain/onboarding.ts";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  ProviderReviewPort,
  ReviewQueueFilters,
} from "../application/review.ts";
export class PostgresProviderReview implements ProviderReviewPort {
  async page(filters: ReviewQueueFilters) {
    const result = await pool.query(
      `SELECT id,name,kind,state,version,
       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
       FROM providers.organizations
       WHERE state='submitted' AND ($1::text IS NULL OR kind=$1)
       AND ($2::timestamptz IS NULL OR (created_at,id)>($2::timestamptz,$3::uuid))
       ORDER BY created_at,id LIMIT 21`,
      [
        filters.kind || null,
        filters.afterCreatedAt ?? null,
        filters.afterId ?? null,
      ],
    );
    const items = result.rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      nextCursor:
        result.rows.length > 20
          ? { afterCreatedAt: last.createdAt, afterId: last.id }
          : null,
    };
  }
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
      await tx.query(
        "SELECT id FROM providers.organizations WHERE id=$1 FOR UPDATE",
        [id],
      );
      const prior = (
        await tx.query(
          "SELECT organization_name,decision,reason,reviewer_id,version FROM providers.review_decisions WHERE organization_id=$1 AND input_version=$2",
          [id, version],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.reviewer_id !== actorId ||
          prior.decision !== state ||
          prior.reason !== reason
        )
          throw new AppError(
            "REVIEW_CONFLICT",
            "This application version already has a different recorded decision.",
            409,
          );
        return {
          id,
          name: prior.organization_name,
          state: prior.decision,
          version: prior.version,
        };
      }
      if (state === "approved")
        requireCompleteOnboarding(
          (
            await tx.query(
              'SELECT legal_name AS "legalName",business_address AS "businessAddress",contact_name AS "contactName",contact_email AS "contactEmail",contact_phone AS "contactPhone" FROM providers.onboarding_details WHERE organization_id=$1',
              [id],
            )
          ).rows[0],
        );
      const result = await tx.query(
        "UPDATE providers.organizations SET state=$3,reason=$4,version=version+1 WHERE id=$1 AND version=$2 AND state='submitted' AND owner_id<>$5 RETURNING id,name,state,version",
        [id, version, state, reason, actorId],
      );
      if (!result.rowCount)
        throw new AppError(
          "CONFLICT",
          "Organization state/version changed, or self-review is prohibited.",
        );
      const saved = result.rows[0];
      await tx.query(
        "INSERT INTO providers.review_decisions(organization_id,version,input_version,reviewer_id,organization_name,decision,reason) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, saved.version, version, actorId, saved.name, state, reason],
      );
      return saved;
    });
  }
}
