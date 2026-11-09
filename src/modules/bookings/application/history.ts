export type HistoryFilters = {
  q?: string;
  state?: "pending_payment" | "confirmed" | "refund_required" | "cancelled";
  period?: "upcoming" | "past";
  from?: string;
  until?: string;
  after?: string;
};
export interface HistoryPort {
  search(owner: string, filters: HistoryFilters): Promise<unknown>;
}
export class BookingHistory {
  constructor(private store: HistoryPort) {}
  search(owner: string, filters: HistoryFilters) {
    return this.store.search(owner, filters);
  }
}
