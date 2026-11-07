import { validateFixture, type FixtureDetails } from "../domain/fixture.ts";
export interface FixturesPort {
  save(
    actor: string,
    org: string,
    key: string,
    input: FixtureDetails,
    id?: string,
    version?: number,
  ): Promise<unknown>;
  list(actor: string, org: string): Promise<unknown>;
  detail(id: string): Promise<unknown>;
}
export class Fixtures {
  constructor(private port: FixturesPort) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: FixtureDetails,
    id?: string,
    version?: number,
  ) {
    validateFixture(input);
    return this.port.save(actor, org, key, input, id, version);
  }
  list(actor: string, org: string) {
    return this.port.list(actor, org);
  }
  detail(id: string) {
    return this.port.detail(id);
  }
}
