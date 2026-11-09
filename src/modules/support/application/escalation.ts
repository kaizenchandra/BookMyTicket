export type EscalationInput = { version: number; reason: string };
export interface EscalationPort {
  request(
    owner: string,
    id: string,
    key: string,
    input: EscalationInput,
  ): Promise<unknown>;
}
export class CustomerEscalation {
  constructor(private store: EscalationPort) {}
  request(owner: string, id: string, key: string, input: EscalationInput) {
    return this.store.request(owner, id, key, input);
  }
}
