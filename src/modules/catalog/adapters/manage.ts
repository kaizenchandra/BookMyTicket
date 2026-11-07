import { randomUUID } from "node:crypto";
import { pool, transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  CatalogManagementPort,
  ListingInput,
} from "../application/manage.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresCatalogManagement implements CatalogManagementPort {
  constructor(private access: OrganizationAccess) {}
  async create(actorId: string, organizationId: string, input: ListingInput) {
    await this.access.requireMember(actorId, organizationId, true);
    return (
      await pool.query(
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
      if (row.metadata.managedBy)
        throw new AppError(
          "CATEGORY_EDITOR_REQUIRED",
          "Use the cinema or sports editor for this draft.",
          409,
        );
      await this.access.requireMember(actorId, row.organization_id, true, tx);
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
      return (
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
      return (
        await tx.query(
          "UPDATE catalog.listings SET state='submitted',version=version+1 WHERE id=$1 RETURNING *",
          [id],
        )
      ).rows[0];
    });
  }
  async review(
    id: string,
    version: number,
    state: "published" | "changes_requested",
    reason: string,
  ) {
    return transaction(async (tx) => {
      const listing = (
        await tx.query(
          "SELECT * FROM catalog.listings WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!listing) throw new AppError("NOT_FOUND", "Listing not found.", 404);
      await this.access.requireApproved(listing.organization_id, tx);
      if (listing.version !== version || listing.state !== "submitted")
        throw new AppError(
          "CONFLICT",
          "Listing is no longer awaiting this review.",
        );
      await tx.query(
        "INSERT INTO catalog.revisions(listing_id,version,snapshot,reason) VALUES($1,$2,$3,$4)",
        [id, version, listing, reason],
      );
      return (
        await tx.query(
          "UPDATE catalog.listings SET state=$2,version=version+1 WHERE id=$1 RETURNING *",
          [id, state],
        )
      ).rows[0];
    });
  }
  async queue() {
    return (
      await pool.query(
        "SELECT * FROM catalog.listings WHERE state='submitted' ORDER BY created_at LIMIT 100",
      )
    ).rows;
  }
}
