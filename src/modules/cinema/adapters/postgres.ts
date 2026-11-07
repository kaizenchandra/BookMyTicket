import { createHash } from "node:crypto";
import { transaction, pool } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type { MoviesPort } from "../application/movies.ts";
import type { MovieDetails } from "../domain/movie.ts";
import type {
  CategoryDrafts,
  PublishedCatalog,
} from "../../catalog/contracts/index.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export class PostgresMovies implements MoviesPort {
  constructor(
    private catalog: CategoryDrafts,
    private published: PublishedCatalog,
    private access: OrganizationAccess,
  ) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: MovieDetails,
    id?: string,
    version?: number,
  ) {
    return transaction(async (tx) => {
      const listing = await this.catalog.write(
        tx,
        actor,
        org,
        "movie",
        key,
        {
          requestFingerprint: createHash("sha256")
            .update(JSON.stringify(input))
            .digest("hex"),
          title: input.title,
          city: input.city,
          description: input.description,
          posterUrl: input.posterUrl,
          metadata: {
            managedBy: "cinema",
            language: input.language,
            genre: input.genre,
            format: input.format,
            certification: input.certification,
            duration: String(input.durationMinutes) + " min",
            performers: input.cast,
            releaseDate: input.releaseDate,
          },
        },
        id,
        version,
      );
      if (!listing.replayed)
        await tx.query(
          "INSERT INTO cinema.movies(listing_id,organization_id,details) VALUES($1,$2,$3) ON CONFLICT(listing_id) DO UPDATE SET details=EXCLUDED.details,version=cinema.movies.version+1 WHERE cinema.movies.details IS DISTINCT FROM EXCLUDED.details",
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
          "SELECT listing_id,details FROM cinema.movies WHERE organization_id=$1 ORDER BY listing_id LIMIT 100",
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
          "SELECT details,version FROM cinema.movies WHERE listing_id=$1",
          [id],
        )
      ).rows[0];
      if (!row)
        throw new AppError("NOT_FOUND", "Category details not found.", 404);
      return row;
    });
  }
}
