import { validateEvent, type EventDetails } from "../domain/event.ts";
export interface EventCatalogPort {
  save(
    actor: string,
    org: string,
    key: string,
    input: EventDetails,
    id?: string,
    version?: number,
  ): Promise<unknown>;
  list(actor: string, org: string): Promise<unknown>;
  detail(id: string): Promise<unknown>;
}
export class EventCatalog {
  constructor(private port: EventCatalogPort) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: EventDetails,
    id?: string,
    version?: number,
  ) {
    validateEvent(input);
    return this.port.save(actor, org, key, input, id, version);
  }
  list(actor: string, org: string) {
    return this.port.list(actor, org);
  }
  detail(id: string) {
    return this.port.detail(id);
  }
}
