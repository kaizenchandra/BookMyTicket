import type { Transaction } from "../../../shared/database.ts";
export type { CommercialPolicy, PriceBreakdown } from "../domain/quote.ts";
import type { CommercialPolicy, PriceBreakdown } from "../domain/quote.ts";
export type Quote = {
  id: string;
  ownerId: string;
  reservationId: string;
  policyId: string;
  policyLabel: string;
  policy: CommercialPolicy;
  prices: PriceBreakdown;
  expiresAt: string;
  serverTime: string;
  version: 1;
  reservationSnapshot: unknown;
};
export interface QuoteAcceptance {
  accept(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    quoteId: string,
    reservationSnapshot: unknown,
  ): Promise<Quote>;
}
