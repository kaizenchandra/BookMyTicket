import type { OnboardingDetails } from "../domain/onboarding.ts";
export interface OnboardingStore {
  readOwner(actor: string, org: string): Promise<unknown>;
  readReview(actor: string, org: string): Promise<unknown>;
  save(
    actor: string,
    org: string,
    input: OnboardingDetails & { expectedVersion: number },
  ): Promise<unknown>;
}
export class Onboarding {
  constructor(private store: OnboardingStore) {}
  readOwner(actor: string, org: string) {
    return this.store.readOwner(actor, org);
  }
  readReview(actor: string, org: string) {
    return this.store.readReview(actor, org);
  }
  save(
    actor: string,
    org: string,
    input: OnboardingDetails & { expectedVersion: number },
  ) {
    return this.store.save(actor, org, input);
  }
}
