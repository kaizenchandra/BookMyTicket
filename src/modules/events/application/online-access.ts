import { validateOnlineAccess } from "../domain/online-access.ts";
export type OnlineSettings = {
  expectedVersion: number;
  url?: string;
  opensAt: string;
  closesAt: string;
  enabled: boolean;
};
export interface OnlineAccessStore {
  configuration(actor: string, occurrence: string): Promise<unknown>;
  configure(
    actor: string,
    occurrence: string,
    input: OnlineSettings,
  ): Promise<unknown>;
  access(
    owner: string,
    order: string,
    occurrence: string,
    reveal: boolean,
  ): Promise<unknown>;
}
export class OnlineAccess {
  constructor(private store: OnlineAccessStore) {}
  configuration(actor: string, occurrence: string) {
    return this.store.configuration(actor, occurrence);
  }
  configure(actor: string, occurrence: string, input: OnlineSettings) {
    validateOnlineAccess(input);
    return this.store.configure(actor, occurrence, input);
  }
  access(owner: string, order: string, occurrence: string, reveal = false) {
    return this.store.access(owner, order, occurrence, reveal);
  }
}
