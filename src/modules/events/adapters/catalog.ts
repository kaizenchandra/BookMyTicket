import { createHash } from "node:crypto";
import { transaction, pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { EventCatalogPort } from "../application/catalog.ts";
import type { EventDetails } from "../domain/event.ts";
import type {
  CategoryDrafts,
  PublishedCatalog,
} from "../../catalog/contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresEventCatalog implements EventCatalogPort {
  constructor(
    private catalog: CategoryDrafts,
    private published: PublishedCatalog,
    private access: OrganizationAccess,
  ) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: EventDetails,
    id?: string,
    version?: number,
  ) {
    return transaction(async (tx) => {
      const listing = await this.catalog.write(
        tx,
        actor,
        org,
        "event",
        key,
        {
          requestFingerprint: createHash("sha256")
            .update(JSON.stringify(input))
            .digest("hex"),
          title: input.title,
          city: input.city,
          description: input.description,
          posterUrl: input.posterUrl,
          retainedMetadata: {
            organizer: input.organizer,
            inclusions: input.inclusions,
            exclusions: input.exclusions,
            entryInstructions: input.entryInstructions,
          },
          metadata: {
            managedBy: "events",
            language: input.language,
            genre: input.genre,
            duration: String(input.durationMinutes) + " min",
            performers: input.performers,
            minimumAge: String(input.minimumAge),
          },
        },
        id,
        version,
      );
      if (!listing.replayed)
        await tx.query(
          "INSERT INTO events.catalog_details(listing_id,organization_id,details) VALUES($1,$2,$3) ON CONFLICT(listing_id) DO UPDATE SET details=EXCLUDED.details,version=events.catalog_details.version+1 WHERE events.catalog_details.details IS DISTINCT FROM EXCLUDED.details",
          [listing.id, org, input],
        );
      return listing;
    });
  }
  list(actor: string, org: string) {
    return transaction(async (tx) => {
      await this.access.requireMember(actor, org, false, tx);
      const rows = (
        await tx.query(
          "SELECT listing_id,details FROM events.catalog_details WHERE organization_id=$1 ORDER BY listing_id LIMIT 100",
          [org],
        )
      ).rows;
      return Promise.all(
        rows.map(async (row) => ({
          ...(await this.catalog.owned(tx, actor, org, row.listing_id)),
          details: row.details,
        })),
      );
    });
  }
  async detail(id: string) {
    return transaction(async (tx) => {
      await this.published.requirePublished(id, tx);
      const row = (
        await tx.query(
          "SELECT details,version FROM events.catalog_details WHERE listing_id=$1",
          [id],
        )
      ).rows[0];
      if (!row)
        throw new AppError("NOT_FOUND", "Category details not found.", 404);
      return row;
    });
  }
}
