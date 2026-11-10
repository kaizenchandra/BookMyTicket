import type { Transaction } from "./database.ts";
export type CustomerFilters = {
  id?: string;
  contact?: string;
  q?: string;
  status?: "active" | "suspended";
  from?: string;
  until?: string;
  activity?: "all" | "has_bookings" | "no_bookings" | "repeat_confirmed";
  bookingFrom?: string;
  bookingUntil?: string;
  sort?: "newest" | "oldest";
  after?: string;
};
export interface CustomerBookings {
  owners(tx: Transaction, f: CustomerFilters): Promise<string[] | null>;
  summaries(
    tx: Transaction,
    ids: string[],
  ): Promise<
    Record<
      string,
      {
        bookings: string;
        confirmed: string;
        cancelled: string;
        lastBookingAt: string | null;
      }
    >
  >;
  ids(tx: Transaction, owner: string): Promise<string[]>;
  history(
    tx: Transaction,
    owner: string,
    after: string | undefined,
    scope: string,
  ): Promise<unknown>;
}
export interface CustomerProfiles {
  match(tx: Transaction, q: string): Promise<string[]>;
  summaries(
    tx: Transaction,
    ids: string[],
  ): Promise<Record<string, { name: string; city: string | null }>>;
  detail(tx: Transaction, id: string): Promise<unknown>;
}
export interface CustomerHistory {
  history(
    tx: Transaction,
    ids: string[],
    after: string | undefined,
    scope: string,
  ): Promise<unknown>;
}
