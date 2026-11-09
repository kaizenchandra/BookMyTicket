import { AppError } from "../../../shared/errors.ts";
export type SavedAttendee = {
  id: string;
  name: string;
  email: string;
  phone: string;
};
export type SavedAttendeesInput = {
  expectedVersion: number;
  consentVersion: 1;
  consent: boolean;
  items: SavedAttendee[];
};
export interface SavedAttendeesStore {
  get(owner: string): Promise<unknown>;
  history(owner: string, beforeVersion?: number): Promise<unknown>;
  save(owner: string, input: SavedAttendeesInput): Promise<unknown>;
}
export class SavedAttendees {
  constructor(private store: SavedAttendeesStore) {}
  get(owner: string) {
    return this.store.get(owner);
  }
  history(owner: string, beforeVersion?: number) {
    return this.store.history(owner, beforeVersion);
  }
  save(owner: string, input: SavedAttendeesInput) {
    if (input.consent !== input.items.length > 0)
      throw new AppError(
        "CONSENT_REQUIRED",
        "Agree to save attendee details, or clear the list to withdraw consent.",
        422,
      );
    if (new Set(input.items.map((i) => i.id)).size !== input.items.length)
      throw new AppError(
        "DUPLICATE_ATTENDEE",
        "Each saved attendee must have a unique identifier.",
        422,
      );
    return this.store.save(owner, input);
  }
}
