import type { Transaction } from "../../../shared/database.ts";
export type PayableOrder = {
  id: string;
  owner_id: string;
  amount_paise: number;
  currency: string;
  state: string;
  reservation_id: string;
  quote_id: string;
};
export interface PaymentOrderAccess {
  owned(ownerId: string, id: string): Promise<PayableOrder>;
  prepare<T>(
    ownerId: string,
    id: string,
    stage: (tx: Transaction, order: PayableOrder) => Promise<T>,
  ): Promise<T>;
}
