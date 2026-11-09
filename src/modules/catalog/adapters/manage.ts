import type { StaffAuthorization } from "../../identity/contracts/index.ts";
import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  CatalogManagementPort,
  ListingInput,
  ListingQueueFilters,
} from "../application/manage.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresCatalogManagement implements CatalogManagementPort {
  constructor(
    private access: OrganizationAccess,
    private authorization: StaffAuthorization,
  ) {}
  async create(
    actorId: string,
    organizationId: string,
    input: ListingInput,
    key: string,
  ) {
    return transaction(async (tx) => {
      await this.access.requireMember(actorId, organizationId, true, tx);
      await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,57))", [
        JSON.stringify(["catalog.create", actorId, organizationId, key]),
      ]);
      const previous = (
        await tx.query(
          "SELECT input=$4::jsonb AS matches,result FROM catalog.creations WHERE actor_id=$1 AND organization_id=$2 AND operation_key=$3",
          [actorId, organizationId, key, input],
        )
      ).rows[0];
      if (previous) {
        if (!previous.matches)
          throw new AppError(
            "IDEMPOTENCY_CONFLICT",
            "This creation key was already used with different listing content.",
            409,
          );
        return previous.result;
      }
      const result = (
        await tx.query(
          "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,poster_url,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
          [
            randomUUID(),
            organizationId,
            input.title,
            input.kind,
            input.city,
            input.description,
            input.posterUrl ?? null,
            input.metadata,
          ],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO catalog.creations(actor_id,organization_id,operation_key,listing_id,input,result) VALUES($1,$2,$3,$4,$5,$6)",
        [actorId, organizationId, key, result.id, input, result],
      );
      return result;
    });
  }
  async update(
    actorId: string,
    id: string,
    version: number,
    input: ListingInput,
  ) {
    return transaction(async (tx) => {
      const row = (
        await tx.query(
          "SELECT * FROM catalog.listings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!row) throw new AppError("NOT_FOUND", "Listing not found.", 404);
      await this.access.requireMember(actorId, row.organization_id, true, tx);
      const previous = (
        await tx.query(
          "SELECT actor_id,input=$3::jsonb AS matches,result FROM catalog.draft_edits WHERE listing_id=$1 AND input_version=$2",
          [id, version, input],
        )
      ).rows[0];
      if (previous) {
        if (previous.actor_id !== actorId || !previous.matches)
          throw new AppError(
            "CONFLICT",
            "This listing version already has a different recorded draft edit.",
            409,
          );
        return previous.result;
      }
      if (row.metadata.managedBy)
        throw new AppError(
          "CATEGORY_EDITOR_REQUIRED",
          "Use the category editor for this draft.",
          409,
        );
      if (
        row.version !== version ||
        !["draft", "changes_requested"].includes(row.state)
      )
        throw new AppError(
          "CONFLICT",
          "Only the current draft or requested revision can be edited. Refresh its review status.",
          409,
        );
      await tx.query(
        "INSERT INTO catalog.revisions(listing_id,actor_id,version,snapshot) VALUES($1,$2,$3,$4)",
        [id, actorId, version, row],
      );
      const result = (
        await tx.query(
          "UPDATE catalog.listings SET title=$2,kind=$3,city=$4,description=$5,poster_url=$6,metadata=$7,version=version+1 WHERE id=$1 RETURNING *",
          [
            id,
            input.title,
            input.kind,
            input.city,
            input.description,
            input.posterUrl ?? null,
            input.metadata,
          ],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO catalog.draft_edits(listing_id,input_version,version,actor_id,input,result) VALUES($1,$2,$3,$4,$5,$6)",
        [id, version, result.version, actorId, input, result],
      );
      return result;
    });
  }
  async list(actorId: string, organizationId: string) {
    await this.access.requireMember(actorId, organizationId);
    return (
      await pool.query(
        "SELECT * FROM catalog.listings WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
        [organizationId],
      )
    ).rows;
  }
  async submit(actorId: string, id: string, version: number) {
    return transaction(async (tx) => {
      const listing = (
        await tx.query(
          "SELECT * FROM catalog.listings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!listing) throw new AppError("NOT_FOUND", "Listing not found.", 404);
      await this.access.requireMember(
        actorId,
        listing.organization_id,
        true,
        tx,
      );
      const previous = (
        await tx.query(
          "SELECT actor_id,result FROM catalog.submissions WHERE listing_id=$1 AND input_version=$2",
          [id, version],
        )
      ).rows[0];
      if (previous) {
        if (previous.actor_id !== actorId)
          throw new AppError(
            "CONFLICT",
            "Another actor already submitted this listing version.",
            409,
          );
        return previous.result;
      }
      await this.access.requireApproved(listing.organization_id, tx);
      if (
        listing.version !== version ||
        !["draft", "changes_requested"].includes(listing.state)
      )
        throw new AppError(
          "CONFLICT",
          "Listing has changed. Refresh before submitting.",
        );
      await tx.query(
        "INSERT INTO catalog.revisions(listing_id,actor_id,version,snapshot) VALUES($1,$2,$3,$4)",
        [id, actorId, version, listing],
      );
      const result = (
        await tx.query(
          "UPDATE catalog.listings SET state='submitted',version=version+1 WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO catalog.submissions(listing_id,input_version,version,actor_id,result) VALUES($1,$2,$3,$4,$5)",
        [id, version, result.version, actorId, result],
      );
      return result;
    });
  }
  async review(
    id: string,
    version: number,
    state: "published" | "changes_requested",
    reason: string,
    reviewerId: string,
  ) {
    return transaction(async (tx) => {
      await this.authorization.requirePermission(tx, reviewerId, "moderate");
      const listing = (
        await tx.query(
          "SELECT * FROM catalog.listings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!listing) throw new AppError("NOT_FOUND", "Listing not found.", 404);
      const prior = (
        await tx.query(
          "SELECT reviewer_id,decision,reason,result FROM catalog.review_decisions WHERE listing_id=$1 AND input_version=$2",
          [id, version],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.reviewer_id !== reviewerId ||
          prior.decision !== state ||
          prior.reason !== reason
        )
          throw new AppError(
            "CONFLICT",
            "This listing version already has a different recorded decision.",
            409,
          );
        return prior.result;
      }
      await this.access.requireApproved(listing.organization_id, tx);
      if (listing.version !== version || listing.state !== "submitted")
        throw new AppError(
          "CONFLICT",
          "Listing is no longer awaiting this review.",
        );
      await tx.query(
        "INSERT INTO catalog.revisions(listing_id,version,snapshot,reason,actor_id) VALUES($1,$2,$3,$4,$5)",
        [id, version, listing, reason, reviewerId],
      );
      const result = (
        await tx.query(
          "UPDATE catalog.listings SET state=$2,version=version+1 WHERE id=$1 RETURNING *",
          [id, state],
        )
      ).rows[0];
      await tx.query(
        "INSERT INTO catalog.review_decisions(listing_id,input_version,version,reviewer_id,decision,reason,result) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, version, result.version, reviewerId, state, reason, result],
      );
      return result;
    });
  }
  async queuePage(filters: ListingQueueFilters) {
    const result = await pool.query(
      `SELECT id,organization_id AS "organizationId",title,description,city,kind,state,version,
       to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "createdAt"
       FROM catalog.listings WHERE state='submitted' AND ($1::text IS NULL OR kind=$1)
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
        "SELECT * FROM catalog.listings WHERE state='submitted' ORDER BY created_at LIMIT 100",
      )
    ).rows;
  }
}
