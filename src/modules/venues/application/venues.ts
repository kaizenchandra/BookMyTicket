import type { Plan } from "../domain/plan.ts";
export type VenueInput = {
  name: string;
  address: string;
  city: string;
  timeZone: string;
  amenities: string;
  accessibility: string;
};
export type SpaceInput = {
  name: string;
  kind: "screen" | "auditorium" | "stadium" | "hall";
  physicalCapacity: number;
  turnaroundMinutes: number;
};
export interface VenueStore {
  list(actor: string, org: string): Promise<unknown>;
  create(actor: string, org: string, input: VenueInput): Promise<unknown>;
  space(
    actor: string,
    org: string,
    venue: string,
    input: SpaceInput,
  ): Promise<unknown>;
  plan(
    actor: string,
    org: string,
    space: string,
    input: { label: string; expectedVersion: number; configuration: Plan },
  ): Promise<unknown>;
}
export class Venues {
  constructor(private store: VenueStore) {}
  list(actor: string, org: string) {
    return this.store.list(actor, org);
  }
  create(actor: string, org: string, input: VenueInput) {
    return this.store.create(actor, org, input);
  }
  space(actor: string, org: string, venue: string, input: SpaceInput) {
    return this.store.space(actor, org, venue, input);
  }
  plan(
    actor: string,
    org: string,
    space: string,
    input: { label: string; expectedVersion: number; configuration: Plan },
  ) {
    return this.store.plan(actor, org, space, input);
  }
}
