import type { VenueImage } from "../domain/media.ts";
import { validateMedia } from "../domain/media.ts";
export type VenueMedia = { expectedVersion: number; items: VenueImage[] };
export type VenueContact = {
  expectedVersion: number;
  phone: string;
  email: string;
  public: boolean;
};
export type VenueGuidance = {
  expectedVersion: number;
  amenities: string;
  accessibility: string;
  transportGuidance: string;
  parkingGuidance: string;
  entryPolicies: string;
};
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
  media(
    actor: string,
    org: string,
    venue: string,
    input: VenueMedia,
  ): Promise<unknown>;
  contact(
    actor: string,
    org: string,
    venue: string,
    input: VenueContact,
  ): Promise<unknown>;
  guidance(
    actor: string,
    org: string,
    venue: string,
    input: VenueGuidance,
  ): Promise<unknown>;
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
  guidance(actor: string, org: string, venue: string, input: VenueGuidance) {
    return this.store.guidance(actor, org, venue, input);
  }
  contact(actor: string, org: string, venue: string, input: VenueContact) {
    return this.store.contact(actor, org, venue, input);
  }
  media(actor: string, org: string, venue: string, input: VenueMedia) {
    validateMedia(input.items);
    return this.store.media(actor, org, venue, input);
  }
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
