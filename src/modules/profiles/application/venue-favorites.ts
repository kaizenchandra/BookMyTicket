import type { PublicVenueDiscovery } from "../../venues/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export interface VenueFavoritesStore {
  save(owner: string, venue: string): Promise<void>;
  remove(owner: string, venue: string): Promise<void>;
  has(owner: string, venue: string): Promise<boolean>;
  page(
    owner: string,
    after?: string,
  ): Promise<{ venue_id: string; created_at: Date }[]>;
}
export class VenueFavorites {
  constructor(
    private store: VenueFavoritesStore,
    private venues: PublicVenueDiscovery,
  ) {}
  async save(owner: string, id: string) {
    if (!(await this.store.has(owner, id))) {
      await this.venues.read(id);
      await this.store.save(owner, id);
    }
    return { saved: true };
  }
  async remove(owner: string, id: string) {
    await this.store.remove(owner, id);
    return { saved: false };
  }
  async status(owner: string, id: string) {
    return { saved: await this.store.has(owner, id) };
  }
  async list(owner: string, after?: string) {
    const rows = await this.store.page(owner, after),
      page = rows.slice(0, 24);
    const items = [];
    for (const row of page) {
      let venue: {
        id: string;
        name: string;
        city: string;
        address: string;
      } | null = null;
      try {
        const result = await this.venues.read(row.venue_id);
        const { id, name, city, address } = result.venue;
        venue = { id, name, city, address };
      } catch (error) {
        if (!(error instanceof AppError && error.status === 404)) throw error;
      }
      items.push({ venueId: row.venue_id, savedAt: row.created_at, venue });
    }
    return { items, nextCursor: rows.length > 24 ? page[23].venue_id : null };
  }
}
