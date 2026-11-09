import { createHash } from "node:crypto";
import { transaction, pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { FixturesPort } from "../application/fixtures.ts";
import type { FixtureDetails } from "../domain/fixture.ts";
import type {
  CategoryDrafts,
  PublishedCatalog,
} from "../../catalog/contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresFixtures implements FixturesPort {
  constructor(
    private catalog: CategoryDrafts,
    private published: PublishedCatalog,
    private access: OrganizationAccess,
  ) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: FixtureDetails,
    id?: string,
    version?: number,
  ) {
    return transaction(async (tx) => {
      const listing = await this.catalog.write(
        tx,
        actor,
        org,
        "sports",
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
            season: input.season,
            homeTeam: input.homeTeam,
            awayTeam: input.awayTeam,
            hospitality: input.hospitality,
          },
          metadata: {
            managedBy: "sports",
            sport: input.sport,
            competition: input.competition,
            teams: input.homeTeam + " vs " + input.awayTeam,
            entryInstructions: input.entryInstructions,
          },
        },
        id,
        version,
      );
      if (!listing.replayed)
        await tx.query(
          "INSERT INTO sports.fixtures(listing_id,organization_id,details) VALUES($1,$2,$3) ON CONFLICT(listing_id) DO UPDATE SET details=EXCLUDED.details,version=sports.fixtures.version+1 WHERE sports.fixtures.details IS DISTINCT FROM EXCLUDED.details",
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
          "SELECT listing_id,details FROM sports.fixtures WHERE organization_id=$1 ORDER BY listing_id LIMIT 100",
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
          "SELECT details,version FROM sports.fixtures WHERE listing_id=$1",
          [id],
        )
      ).rows[0];
      if (!row)
        throw new AppError("NOT_FOUND", "Category details not found.", 404);
      return row;
    });
  }
}
