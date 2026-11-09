export type CommunicationInput = {
  language: string;
  marketingEmail: boolean;
  version: number;
  consentVersion: 1;
};
export interface CommunicationStore {
  get(owner: string): Promise<unknown>;
  history(owner: string, beforeVersion?: number): Promise<unknown>;
  save(owner: string, input: CommunicationInput): Promise<unknown>;
}
export class Communications {
  constructor(private readonly store: CommunicationStore) {}
  get(owner: string) {
    return this.store.get(owner);
  }
  history(owner: string, beforeVersion?: number) {
    return this.store.history(owner, beforeVersion);
  }
  save(owner: string, input: CommunicationInput) {
    return this.store.save(owner, input);
  }
}
