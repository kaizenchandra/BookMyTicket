export interface ProviderReviewPort {
  queue(): Promise<unknown>;
  review(
    id: string,
    version: number,
    state: "approved" | "changes_requested" | "rejected",
    reason: string,
    actorId: string,
  ): Promise<unknown>;
}
