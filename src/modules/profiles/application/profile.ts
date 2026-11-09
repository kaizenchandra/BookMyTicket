export type ProfileInput = {
  name: string;
  theme: "LIGHT" | "DARK";
  city: string | null;
  expectedVersion: number;
};
export interface ProfileStore {
  get(owner: string): Promise<unknown>;
  save(owner: string, input: ProfileInput): Promise<unknown>;
}
export class Profile {
  constructor(private store: ProfileStore) {}
  get(owner: string) {
    return this.store.get(owner);
  }
  save(owner: string, input: ProfileInput) {
    return this.store.save(owner, input);
  }
}
