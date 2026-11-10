export interface BookingTimelineStore {
  get(owner: string, booking: string): Promise<unknown>;
}
export class BookingTimeline {
  constructor(private store: BookingTimelineStore) {}
  get(owner: string, booking: string) {
    return this.store.get(owner, booking);
  }
}
