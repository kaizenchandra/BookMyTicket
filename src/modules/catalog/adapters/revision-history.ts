import { projectRevisionSnapshot } from "../domain/revision-snapshot.ts";
import { compareRevisionSnapshots } from "../domain/revision-comparison.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import { transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { SecurityAudit } from "../../reporting/contracts/index.ts";
import type { ListingRevisionHistoryStore } from "../application/revision-history.ts";
export class PostgresListingRevisionHistory implements ListingRevisionHistoryStore {
  constructor(
    private audit: SecurityAudit,
    private authorization: StaffAuthorization,
    private access: OrganizationAccess,
  ) {}
  compare(
    actor: string,
    listing: string,
    reviewer: boolean,
    fromId: string,
    toId: string,
  ) {
    return transaction(async (tx) => {
      if (reviewer)
        await this.authorization.requirePermission(tx, actor, "moderate");
      const listingRow = (
        await tx.query(
          "SELECT organization_id FROM catalog.listings WHERE id=$1 FOR SHARE",
          [listing],
        )
      ).rows[0];
      if (!listingRow)
        throw new AppError("NOT_FOUND", "Listing not found.", 404);
      if (!reviewer)
        await this.access.requireMember(
          actor,
          listingRow.organization_id,
          false,
          tx,
        );
      const rows = (
        await tx.query(
          `SELECT id::text AS id,version,snapshot FROM catalog.revisions WHERE listing_id=$1 AND id IN ($2::bigint,$3::bigint)`,
          [listing, fromId, toId],
        )
      ).rows;
      const from = rows.find((r) => r.id === fromId),
        to = rows.find((r) => r.id === toId);
      if (!from || !to)
        throw new AppError(
          "NOT_FOUND",
          "Both revisions must belong to this listing.",
          404,
        );
      const changes = compareRevisionSnapshots(
        projectRevisionSnapshot(from.snapshot),
        projectRevisionSnapshot(to.snapshot),
      );
      await this.audit.record(
        tx,
        actor,
        "listing.revision_comparison.read",
        listing,
        {
          audience: reviewer ? "reviewer" : "organization",
          fromId,
          toId,
          changedFields: changes.map((c) => c.field),
        },
      );
      return {
        from: { id: from.id, version: from.version },
        to: { id: to.id, version: to.version },
        changes,
      };
    });
  }
  list(actor: string, listing: string, reviewer: boolean, beforeId?: string) {
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
        `SELECT id::text AS id,version,reason,created_at AS "createdAt",
          snapshot
          ${reviewer ? ',actor_id AS "actorId"' : ""}
          FROM catalog.revisions WHERE listing_id=$1 AND ($2::bigint IS NULL OR id<$2::bigint) ORDER BY id DESC LIMIT 21`,
        [listing, beforeId ?? null],
      );
      const items = result.rows
        .slice(0, 20)
        .map((row) => ({
          ...row,
          snapshot: projectRevisionSnapshot(row.snapshot),
        }));
      await this.audit.record(
        tx,
        actor,
        "listing.revision_history.read",
        listing,
        {
          audience: reviewer ? "reviewer" : "organization",
          count: items.length,
          olderPage: beforeId !== undefined,
        },
      );
      return {
        items,
        nextCursor: result.rows.length > 20 ? items[19].id : null,
      };
    });
  }
}
