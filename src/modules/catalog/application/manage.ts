import type { OrganizationAccess } from "../../providers/contracts/index.ts";
export interface CatalogManagementPort {
  create(
    actorId: string,
    organizationId: string,
    input: ListingInput,
  ): Promise<unknown>;
  list(actorId: string, organizationId: string): Promise<unknown>;
  submit(actorId: string, id: string, version: number): Promise<unknown>;
  review(
    id: string,
    version: number,
    state: "published" | "changes_requested",
    reason: string,
  ): Promise<unknown>;
  queue(): Promise<unknown>;
  update(
    actorId: string,
    id: string,
    version: number,
    input: ListingInput,
  ): Promise<unknown>;
}
export type ListingInput = {
  title: string;
  kind: "movie" | "event" | "sports";
  city: string;
  description: string;
  posterUrl?: string;
  metadata: Record<string, string>;
};
export class CatalogManagement {
  constructor(
    private port: CatalogManagementPort,
    private access: OrganizationAccess,
  ) {}
  async create(actorId: string, organizationId: string, input: ListingInput) {
    await this.access.requireMember(actorId, organizationId, true);
    return this.port.create(actorId, organizationId, input);
  }
  async list(actorId: string, organizationId: string) {
    await this.access.requireMember(actorId, organizationId);
    return this.port.list(actorId, organizationId);
  }
  submit(actorId: string, id: string, version: number) {
    return this.port.submit(actorId, id, version);
  }
  update(actorId: string, id: string, version: number, input: ListingInput) {
    return this.port.update(actorId, id, version, input);
  }
  review(
    id: string,
    version: number,
    state: "published" | "changes_requested",
    reason: string,
  ) {
    return this.port.review(id, version, state, reason);
  }
  queue() {
    return this.port.queue();
  }
}
