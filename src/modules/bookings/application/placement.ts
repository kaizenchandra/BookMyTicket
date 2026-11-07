import { createHash } from "node:crypto";
import type { InventoryCommerce } from "../../inventory/contracts/index.ts";
import type { QuoteAcceptance, Quote } from "../../pricing/contracts/index.ts";
import type { Transaction } from "../../../shared/database.ts";
import { AppError } from "../../../shared/errors.ts";
import type {
  RegistrationForms,
  RegistrationInput,
  AcceptedRegistration,
} from "../../events/contracts/index.ts";
export type PlacementInput = {
  registration?: RegistrationInput;
  reservationId: string;
  quoteId: string;
  acceptPolicies: boolean;
};
export interface PlacementStore {
  registrationFingerprint(input?: RegistrationInput): string | undefined;
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  serialize(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    key: string,
  ): Promise<void>;
  previous(
    tx: Transaction,
    ownerId: string,
    key: string,
    fingerprint: string,
  ): Promise<unknown | null>;
  existing(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    quoteId: string,
    digest?: string,
  ): Promise<unknown | null>;
  recordCommand(
    tx: Transaction,
    ownerId: string,
    key: string,
    fingerprint: string,
    order: unknown,
  ): Promise<void>;
  place(
    tx: Transaction,
    ownerId: string,
    quote: Quote,
    registration: AcceptedRegistration | null,
    digest?: string,
  ): Promise<unknown>;
}
export class OrderPlacement {
  constructor(
    private store: PlacementStore,
    private inventory: InventoryCommerce,
    private quotes: QuoteAcceptance,
    private forms: RegistrationForms,
  ) {}
  async accept(ownerId: string, key: string, input: PlacementInput) {
    if (!input.acceptPolicies)
      throw new AppError(
        "POLICY_ACCEPTANCE_REQUIRED",
        "Review and accept the displayed cancellation and admission policies.",
        422,
      );
    if (key.length < 8 || key.length > 100)
      throw new AppError(
        "INVALID_IDEMPOTENCY_KEY",
        "A stable operation key is required.",
        422,
      );
    const digest = this.store.registrationFingerprint(input.registration);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          reservationId: input.reservationId,
          quoteId: input.quoteId,
          acceptPolicies: true,
          ...(digest ? { registration: digest } : {}),
        }),
      )
      .digest("hex");
    return this.store.unitOfWork(async (tx) => {
      await this.store.serialize(tx, ownerId, input.reservationId, key);
      const previous = await this.store.previous(tx, ownerId, key, fingerprint);
      if (previous) return previous;
      let order = await this.store.existing(
        tx,
        ownerId,
        input.reservationId,
        input.quoteId,
        digest,
      );
      if (!order) {
        const reservation = await this.inventory.snapshot(
          tx,
          ownerId,
          input.reservationId,
        );
        const quote = await this.quotes.accept(
          tx,
          ownerId,
          input.reservationId,
          input.quoteId,
          reservation,
        );
        const registration = await this.forms.validate(
          tx,
          reservation.occurrences[0]!.id,
          reservation.items.reduce((n, i) => n + i.quantity, 0),
          input.registration,
        );
        order = await this.store.place(
          tx,
          ownerId,
          quote,
          registration,
          digest,
        );
      }
      await this.store.recordCommand(tx, ownerId, key, fingerprint, order);
      return order;
    });
  }
}
