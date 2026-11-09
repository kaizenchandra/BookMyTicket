export type AuditFilters = {
  actor?: string;
  action?: string;
  target?: string;
  from?: string;
  until?: string;
  after?: string;
};
export interface AuditSearchPort {
  search(actor: string, filters: AuditFilters): Promise<unknown>;
}
export class AuditHistory {
  constructor(private port: AuditSearchPort) {}
  search(actor: string, filters: AuditFilters) {
    return this.port.search(actor, filters);
  }
}
