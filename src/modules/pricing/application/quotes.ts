import { isDeepStrictEqual } from "node:util";
import { calculate } from "../domain/quote.ts";
import type { CommercialPolicy } from "../domain/quote.ts";
import type { Quote, QuoteAcceptance } from "../contracts/index.ts";
import type {
  InventoryCommerce,
  ReservedSnapshot,
} from "../../inventory/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
export interface QuoteStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  policy(
    tx: Transaction,
    occurrenceId: string,
  ): Promise<{ id: string; label: string; configuration: CommercialPolicy }>;
  find(tx: Transaction, ownerId: string, id: string): Promise<Quote>;
  persist(
    tx: Transaction,
    ownerId: string,
    snapshot: ReservedSnapshot,
    policy: { id: string; label: string; configuration: CommercialPolicy },
    prices: ReturnType<typeof calculate>,
  ): Promise<Quote>;
}
export class Quotes implements QuoteAcceptance {
  constructor(
    private store: QuoteStore,
    private inventory: InventoryCommerce,
  ) {}
  create(ownerId: string, reservationId: string) {
    return this.store.unitOfWork(async (tx) => {
      const snapshot = await this.inventory.snapshot(
        tx,
        ownerId,
        reservationId,
      );
      const policy = await this.store.policy(tx, this.occurrence(snapshot));
      return this.store.persist(
        tx,
        ownerId,
        snapshot,
        policy,
        calculate(snapshot.items, policy.configuration),
      );
    });
  }
  private occurrence(snapshot: ReservedSnapshot) {
    const ids = [...new Set(snapshot.items.map((i) => i.occurrence_id))];
    if (ids.length !== 1)
      throw new AppError(
        "UNSUPPORTED_CART",
        "One occurrence is supported per commercial quote.",
        422,
      );
    return ids[0];
  }
  async accept(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    quoteId: string,
    reservationSnapshot: unknown,
  ) {
    const snapshot = reservationSnapshot as ReservedSnapshot;
    const policy = await this.store.policy(tx, this.occurrence(snapshot));
    const quote = await this.store.find(tx, ownerId, quoteId);
    if (quote.reservationId !== reservationId)
      throw new AppError(
        "QUOTE_MISMATCH",
        "This quote belongs to a different reservation.",
        409,
      );
    if (quote.policyId !== policy.id)
      throw new AppError(
        "QUOTE_CHANGED",
        "Commercial terms changed. Retrieve and review a fresh quote.",
        409,
      );
    if (
      !isDeepStrictEqual(
        JSON.parse(JSON.stringify(snapshot)),
        quote.reservationSnapshot,
      )
    )
      throw new AppError(
        "QUOTE_CHANGED",
        "The occurrence or selection changed. Release this hold and review a new reservation.",
        409,
      );
    const prices = calculate(snapshot.items, policy.configuration);
    if (!isDeepStrictEqual(prices, quote.prices))
      throw new AppError(
        "QUOTE_CHANGED",
        "The selection or price changed. Review a fresh quote.",
        409,
      );
    return quote;
  }
}
