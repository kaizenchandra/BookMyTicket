import { validatePolicy, type CommercialPolicy } from "../domain/quote.ts";
import type { Transaction } from "../../../shared/database.ts";
import type { PolicyTarget } from "../../inventory/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export type PolicyInput = {
  label: string;
  configuration: CommercialPolicy;
  reason: string;
};
export interface PolicyStore {
  unitOfWork<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  create(actorId: string, input: PolicyInput): Promise<unknown>;
  list(): Promise<unknown[]>;
  assignment(occurrenceId: string): Promise<unknown | null>;
  assign(
    tx: Transaction,
    actorId: string,
    occurrenceId: string,
    policyId: string,
    expectedVersion: number,
  ): Promise<unknown>;
}
export class Policies {
  constructor(
    private store: PolicyStore,
    private target: PolicyTarget,
  ) {}
  create(actorId: string, input: PolicyInput) {
    validatePolicy(input.configuration);
    if (input.label.trim().length < 2 || input.reason.trim().length < 5)
      throw new AppError(
        "INVALID_POLICY",
        "Name and approval reason are required.",
        422,
      );
    return this.store.create(actorId, input);
  }
  list() {
    return this.store.list();
  }
  assignment(occurrenceId: string) {
    return this.store.assignment(occurrenceId);
  }
  assign(
    actorId: string,
    occurrenceId: string,
    policyId: string,
    expectedVersion: number,
  ) {
    return this.store.unitOfWork(async (tx) => {
      await this.target.lockForPolicy(tx, occurrenceId);
      return this.store.assign(
        tx,
        actorId,
        occurrenceId,
        policyId,
        expectedVersion,
      );
    });
  }
}
