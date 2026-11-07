import type { FavoriteCatalog } from "../../catalog/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
export interface FavoritesStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  save(tx: Transaction, ownerId: string, listingId: string): Promise<void>;
  remove(ownerId: string, listingId: string): Promise<void>;
  has(ownerId: string, listingId: string): Promise<boolean>;
  page(
    ownerId: string,
    after?: string,
  ): Promise<{ listing_id: string; created_at: Date }[]>;
}
export class Favorites {
  constructor(
    private store: FavoritesStore,
    private catalog: FavoriteCatalog,
  ) {}
  async save(ownerId: string, listingId: string) {
    await this.store.unitOfWork(async (tx) => {
      await this.catalog.requirePublished(listingId, tx);
      await this.store.save(tx, ownerId, listingId);
    });
    return { saved: true };
  }
  async remove(ownerId: string, listingId: string) {
    await this.store.remove(ownerId, listingId);
    return { saved: false };
  }
  async status(ownerId: string, listingId: string) {
    return { saved: await this.store.has(ownerId, listingId) };
  }
  async list(ownerId: string, after?: string) {
    const records = await this.store.page(ownerId, after),
      page = records.slice(0, 24),
      summaries = await this.catalog.summaries(page.map((r) => r.listing_id)),
      byId = new Map(summaries.map((s) => [s.id, s]));
    return {
      items: page.map((r) => ({
        listingId: r.listing_id,
        savedAt: r.created_at,
        listing: byId.get(r.listing_id) ?? null,
      })),
      nextCursor: records.length > 24 ? page[23].listing_id : null,
    };
  }
}
