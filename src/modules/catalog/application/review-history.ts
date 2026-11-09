export interface ListingReviewHistoryStore {
  list(
    actor: string,
    listing: string,
    reviewer: boolean,
    beforeVersion?: number,
  ): Promise<unknown>;
}
export class ListingReviewHistory {
  constructor(private store: ListingReviewHistoryStore) {}
  list(
    actor: string,
    listing: string,
    reviewer: boolean,
    beforeVersion?: number,
  ) {
    return this.store.list(actor, listing, reviewer, beforeVersion);
  }
}
