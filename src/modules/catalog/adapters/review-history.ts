import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { ListingReviewHistoryStore } from "../application/review-history.ts";
export class PostgresListingReviewHistory implements ListingReviewHistoryStore {
  constructor(
    private audit: SecurityAudit,
    private authorization: StaffAuthorization,
    private access: OrganizationAccess,
  ) {}
  list(
    actor: string,
    listing: string,
    reviewer: boolean,
    beforeVersion?: number,
  ) {
    return transaction(async (tx) => {
      if (reviewer)
        await this.authorization.requirePermission(tx, actor, "moderate");
      const row = await tx.query(
        "SELECT organization_id FROM catalog.listings WHERE id=$1 FOR SHARE",
        [listing],
      );
      if (!row.rowCount)
        throw new AppError("NOT_FOUND", "Listing not found.", 404);
      if (!reviewer)
        await this.access.requireMember(
          actor,
          row.rows[0].organization_id,
          false,
          tx,
        );
      const result = await tx.query(
        `SELECT version,input_version AS "inputVersion",decision,reason,created_at AS "createdAt"${reviewer ? ',reviewer_id AS "reviewerId"' : ""} FROM catalog.review_decisions WHERE listing_id=$1 AND ($2::int IS NULL OR input_version<$2-1) ORDER BY input_version DESC LIMIT 21`,
        [listing, beforeVersion ?? null],
      );
      const items = result.rows.slice(0, 20);
      await this.audit.record(
        tx,
        actor,
        "listing.review_history.read",
        listing,
        {
          audience: reviewer ? "reviewer" : "organization",
          count: items.length,
          olderPage: beforeVersion !== undefined,
        },
      );
      return {
        items,
        nextCursor: result.rows.length > 20 ? items[19].version : null,
      };
    });
  }
}
