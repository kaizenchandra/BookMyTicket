import type { Transaction } from "./database.ts";
export type DashboardSelection = {
  product?: "movie" | "event" | "sports";
  city?: string;
  supplier?: string;
  state?: "pending_payment" | "confirmed" | "cancelled" | "refund_required";
  currency?: "INR";
};
export type DashboardPeriod = {
  from: string;
  until: string;
  listingIds?: string[] | null;
  bookingIds?: string[] | null;
  state?: string;
  grain?: "day" | "month";
};
export interface DashboardSource<T = Record<string, unknown>> {
  read(tx: Transaction, period: DashboardPeriod): Promise<T>;
}
export interface DashboardCatalog {
  classify(tx: Transaction, ids: string[]): Promise<Record<string, string>>;
  match(tx: Transaction, filters: DashboardSelection): Promise<string[] | null>;
}
export interface DashboardBookings extends DashboardSource {
  matching(
    tx: Transaction,
    listings: string[] | null,
    state?: string,
  ): Promise<string[] | null>;
}
export type DashboardRecord = {
  id: string;
  state: string;
  amount_paise: string | null;
  at: string;
  label: string;
  booking_id?: string | null;
};
export interface DashboardRecordSource {
  records(
    tx: Transaction,
    period: DashboardPeriod,
    kind: string,
    after?: string,
    scope?: string,
  ): Promise<{ items: DashboardRecord[]; nextCursor: string | null }>;
}
