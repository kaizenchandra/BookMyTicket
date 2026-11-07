export interface SessionStore {
  list(token: string): Promise<unknown>;
  revoke(token: string, targetId: string | "others"): Promise<unknown>;
}
export class Sessions {
  constructor(private store: SessionStore) {}
  list(token: string) {
    return this.store.list(token);
  }
  revoke(token: string, targetId: string | "others") {
    return this.store.revoke(token, targetId);
  }
}
