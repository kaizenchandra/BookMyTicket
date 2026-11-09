export interface OrganizationDraftStore {
  edit(
    actor: string,
    id: string,
    name: string,
    version: number,
  ): Promise<unknown>;
  submit(actor: string, id: string, version: number): Promise<unknown>;
}
export class OrganizationDrafts {
  constructor(private store: OrganizationDraftStore) {}
  edit(
    actor: string,
    id: string,
    input: { name: string; expectedVersion: number },
  ) {
    return this.store.edit(actor, id, input.name, input.expectedVersion);
  }
  submit(actor: string, id: string, version: number) {
    return this.store.submit(actor, id, version);
  }
}
