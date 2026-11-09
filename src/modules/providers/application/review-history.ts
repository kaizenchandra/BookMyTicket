export interface ReviewHistoryStore {
  list(
    actor: string,
    org: string,
    reviewer: boolean,
    beforeVersion?: number,
  ): Promise<unknown>;
}
export class ReviewHistory {
  constructor(private store: ReviewHistoryStore) {}
  list(actor: string, org: string, reviewer: boolean, beforeVersion?: number) {
    return this.store.list(actor, org, reviewer, beforeVersion);
  }
}
