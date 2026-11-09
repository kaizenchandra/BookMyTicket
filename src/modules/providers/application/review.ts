export type ReviewQueueFilters = {
  kind?: "cinema" | "event" | "sports" | "";
  afterCreatedAt?: string;
  afterId?: string;
};
export interface ProviderReviewPort {
  queue(): Promise<unknown>;
  page(filters: ReviewQueueFilters): Promise<unknown>;
  review(
    id: string,
    version: number,
    state: "approved" | "changes_requested" | "rejected",
    reason: string,
    actorId: string,
  ): Promise<unknown>;
}
