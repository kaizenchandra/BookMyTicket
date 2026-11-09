import type { Access } from "../contracts/index.ts";
export type SupportDirectoryFilters = { q: string; after?: string };
export interface SupportDirectoryPort {
  search(actor: string, filters: SupportDirectoryFilters): Promise<unknown>;
}
export class SupportDirectory {
  constructor(
    private access: Access,
    private port: SupportDirectoryPort,
  ) {}
  async search(token: string | undefined, filters: SupportDirectoryFilters) {
    const actor = await this.access.authenticate(token);
    await this.access.require(actor, "support");
    await this.access.require(actor, "support_assign");
    return this.port.search(actor.id, filters);
  }
}
