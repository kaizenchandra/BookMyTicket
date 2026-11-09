import type { Access } from "../../identity/contracts/index.ts";
export type AssignmentInput = {
  version: number;
  assigneeId: string;
  reason: string;
};
export interface AssignmentPort {
  assign(
    actor: string,
    id: string,
    key: string,
    input: AssignmentInput,
  ): Promise<unknown>;
}
export class SupportAssignment {
  constructor(
    private access: Access,
    private store: AssignmentPort,
  ) {}
  async assign(
    token: string | undefined,
    id: string,
    key: string,
    input: AssignmentInput,
  ) {
    const actor = await this.access.authenticate(token);
    await this.access.require(actor, "support");
    await this.access.require(actor, "support_assign");
    return this.store.assign(actor.id, id, key, input);
  }
}
