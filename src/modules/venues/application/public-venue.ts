import type { VenueImage } from "../domain/media.ts";
import type { OrganizationAccess } from "../../providers/contracts/index.ts";
import type { PublicVenueSessions } from "../../catalog/contracts/index.ts";
import { AppError } from "../../../shared/errors.ts";
export type VenueDetails = {
  media: VenueImage[];
  contact: { phone: string; email: string } | null;
  id: string;
  organizationId: string;
  name: string;
  address: string;
  city: string;
  timeZone: string;
  amenities: string;
  accessibility: string;
  transportGuidance: string;
  parkingGuidance: string;
  entryPolicies: string;
};
export interface PublicVenueStore {
  find(id: string): Promise<VenueDetails | null>;
}
export class PublicVenue {
  constructor(
    private store: PublicVenueStore,
    private providers: OrganizationAccess,
    private sessions: PublicVenueSessions,
  ) {}
  async read(id: string, after?: string) {
    const venue = await this.store.find(id);
    if (!venue)
      throw new AppError("NOT_FOUND", "Venue is not publicly available.", 404);
    try {
      await this.providers.requireApproved(venue.organizationId);
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.status === 403 || error.status === 404)
      )
        throw new AppError(
          "NOT_FOUND",
          "Venue is not publicly available.",
          404,
        );
      throw error;
    }
    const result = await this.sessions.read(id, venue.organizationId, after);
    if (!result.visible)
      throw new AppError("NOT_FOUND", "Venue is not publicly available.", 404);
    const { organizationId, ...details } = venue;
    return {
      venue: details,
      items: result.items,
      nextCursor: result.nextCursor,
    };
  }
}
