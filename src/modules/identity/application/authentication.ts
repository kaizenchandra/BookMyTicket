import type { Principal } from "../contracts/index.ts";
export interface OtpDelivery {
  send(contact: string, code: string): Promise<void>;
  available(): boolean;
}
export interface IdentityStore {
  request(contact: string): Promise<unknown>;
  verify(
    id: string,
    code: string,
  ): Promise<{ token: string; principal: Principal }>;
}
export class Authentication {
  constructor(private store: IdentityStore) {}
  request(contact: string) {
    return this.store.request(contact.trim().toLowerCase());
  }
  verify(id: string, code: string) {
    return this.store.verify(id, code);
  }
}
