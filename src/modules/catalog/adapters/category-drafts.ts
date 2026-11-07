import { randomUUID, createHash } from "node:crypto";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { CategoryDrafts, CategoryDraftInput } from "../contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresCategoryDrafts implements CategoryDrafts {
  constructor(private access: OrganizationAccess) {}
  async owned(tx: Transaction, actor: string, org: string, id: string) {
    await this.access.requireMember(actor, org, false, tx);
    const row = (
      await tx.query(
        "SELECT id,version,state FROM catalog.listings WHERE id=$1 AND organization_id=$2",
        [id, org],
      )
    ).rows[0];
    if (!row) throw new AppError("NOT_FOUND", "Listing not found.", 404);
    return row;
  }
  async write(
    tx: Transaction,
    actor: string,
    org: string,
    kind: "movie" | "sports" | "event",
    key: string,
    input: CategoryDraftInput,
    id?: string,
    version?: number,
  ) {
    await this.access.requireMember(actor, org, true, tx);
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,22))", [
      `${actor}:${org}:${key}`,
    ]);
    const fingerprint = createHash("sha256")
      .update(JSON.stringify({ kind, input, id, version }))
      .digest("hex");
    const previous = (
      await tx.query(
        "SELECT * FROM catalog.category_commands WHERE owner_id=$1 AND organization_id=$2 AND operation_key=$3",
        [actor, org, key],
      )
    ).rows[0];
    if (previous) {
      if (previous.fingerprint !== fingerprint)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          "This key was used with different category details.",
          409,
        );
      return {
        ...(await this.owned(tx, actor, org, previous.listing_id)),
        replayed: true,
      };
    }
    const listingId = id ?? randomUUID();
    if (id) {
      const row = (
        await tx.query(
          "SELECT * FROM catalog.listings WHERE id=$1 AND organization_id=$2 AND kind=$3 FOR UPDATE",
          [id, org, kind],
        )
      ).rows[0];
      if (!row)
        throw new AppError("NOT_FOUND", "Category listing not found.", 404);
      if (row.metadata.demo === "true") input.metadata.demo = "true";
      if (
        row.version !== version ||
        !["draft", "changes_requested"].includes(row.state)
      )
        throw new AppError(
          "CONFLICT",
          "Only the current draft or requested revision can be edited.",
          409,
        );
      await tx.query(
        "INSERT INTO catalog.revisions(listing_id,actor_id,version,snapshot) VALUES($1,$2,$3,$4)",
        [id, actor, row.version, row],
      );
      await tx.query(
        "UPDATE catalog.listings SET title=$2,city=$3,description=$4,poster_url=$5,metadata=$6,version=version+1 WHERE id=$1",
        [
          id,
          input.title,
          input.city,
          input.description,
          input.posterUrl ?? null,
          input.metadata,
        ],
      );
    } else
      await tx.query(
        "INSERT INTO catalog.listings(id,organization_id,title,kind,city,description,poster_url,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          listingId,
          org,
          input.title,
          kind,
          input.city,
          input.description,
          input.posterUrl ?? null,
          input.metadata,
        ],
      );
    await tx.query(
      "INSERT INTO catalog.category_commands(owner_id,organization_id,operation_key,fingerprint,listing_id) VALUES($1,$2,$3,$4,$5)",
      [actor, org, key, fingerprint, listingId],
    );
    return this.owned(tx, actor, org, listingId);
  }
}
