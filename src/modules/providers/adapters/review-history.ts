import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { ReviewHistoryStore } from "../application/review-history.ts";
export class PostgresReviewHistory implements ReviewHistoryStore {
  constructor(
    private audit: SecurityAudit,
    private authorization: StaffAuthorization,
  ) {}
  list(actor: string, org: string, reviewer: boolean, beforeVersion?: number) {
    return transaction(async (tx) => {
      if (reviewer)
        await this.authorization.requirePermission(tx, actor, "moderate");
      const row = await tx.query(
        "SELECT id FROM providers.organizations WHERE id=$1 FOR SHARE",
        [org],
      );
      if (!row.rowCount)
        throw new AppError("NOT_FOUND", "Organization not found.", 404);
      if (!reviewer) {
        const member = (
          await tx.query(
            "SELECT role FROM providers.memberships WHERE organization_id=$1 AND account_id=$2 FOR SHARE",
            [org, actor],
          )
        ).rows[0];
        if (member?.role !== "owner")
          throw new AppError(
            "FORBIDDEN",
            "Organization owner access is required.",
            403,
          );
      }
      const result = await tx.query(
        `SELECT version,input_version AS "inputVersion",decision,reason,created_at AS "createdAt"${reviewer ? ',reviewer_id AS "reviewerId"' : ""} FROM providers.review_decisions WHERE organization_id=$1 AND ($2::int IS NULL OR version<$2) ORDER BY version DESC LIMIT 21`,
        [org, beforeVersion ?? null],
      );
      const items = result.rows.slice(0, 20);
      await this.audit.record(tx, actor, "provider.review_history.read", org, {
        audience: reviewer ? "reviewer" : "owner",
        count: items.length,
        olderPage: beforeVersion !== undefined,
      });
      return {
        items,
        nextCursor: result.rows.length > 20 ? items[19].version : null,
      };
    });
  }
}
