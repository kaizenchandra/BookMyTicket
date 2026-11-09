export interface ListingRevisionHistoryStore {
  compare(
    actor: string,
    listing: string,
    reviewer: boolean,
    fromId: string,
    toId: string,
  ): Promise<unknown>;
  list(
    actor: string,
    listing: string,
    reviewer: boolean,
    beforeId?: string,
  ): Promise<unknown>;
}
export class ListingRevisionHistory {
  constructor(private store: ListingRevisionHistoryStore) {}
  compare(
    actor: string,
    listing: string,
    reviewer: boolean,
    fromId: string,
    toId: string,
  ) {
    return this.store.compare(actor, listing, reviewer, fromId, toId);
  }
  list(actor: string, listing: string, reviewer: boolean, beforeId?: string) {
    return this.store.list(actor, listing, reviewer, beforeId);
  }
}
