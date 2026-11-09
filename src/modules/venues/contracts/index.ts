import type { Transaction } from "../../../shared/database.ts";
import type { Plan } from "../domain/plan.ts";
export type ScheduledPlan = {
  id: string;
  spaceId: string;
  spaceName: string;
  version: number;
  venueId: string;
  venueName: string;
  address: string;
  city: string;
  timeZone: string;
  amenities: string;
  accessibility: string;
  turnaroundMinutes: number;
  configuration: Plan;
};
export interface VenuePlans {
  lockForSchedule(
    tx: Transaction,
    organizationId: string,
    planId: string,
  ): Promise<ScheduledPlan>;
}

export interface PublicVenueDiscovery {
  read(
    id: string,
  ): Promise<{
    venue: { id: string; name: string; city: string; address: string };
  }>;
}
