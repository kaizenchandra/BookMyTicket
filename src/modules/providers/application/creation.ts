export type OrganizationCreationInput = {
  name: string;
  kind: "cinema" | "event" | "sports";
};
export interface OrganizationCreationPort {
  create(
    actor: string,
    input: OrganizationCreationInput,
    key: string,
  ): Promise<{
    id: string;
    name: string;
    kind: string;
    state: string;
    version: number;
  }>;
}
export class OrganizationCreation {
  constructor(private port: OrganizationCreationPort) {}
  create(actor: string, input: OrganizationCreationInput, key: string) {
    return this.port.create(actor, input, key);
  }
}
