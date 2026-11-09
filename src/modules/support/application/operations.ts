import type { Access } from "../../identity/contracts/index.ts";
import type { CaseAction, Priority } from "../domain/workflow.ts";
export type CaseFilters = {
  after?: string;
  state?: string;
  priority?: string;
  category?: string;
  assignment?: string;
};
export interface SupportOperationsPort {
  queue(actor: string, filters: CaseFilters): Promise<unknown>;
  detail(actor: string, id: string, after?: string): Promise<unknown>;
  change(
    actor: string,
    id: string,
    input: {
      version: number;
      action: CaseAction;
      priority?: Priority;
      reason: string;
    },
    operationKey?: string,
  ): Promise<unknown>;
  reply(
    actor: string,
    id: string,
    input: { version: number; audience: "customer" | "internal"; body: string },
    operationKey?: string,
  ): Promise<unknown>;
}
export class SupportOperations {
  constructor(
    private access: Access,
    private port: SupportOperationsPort,
  ) {}
  private async actor(token: string | undefined) {
    const actor = await this.access.authenticate(token);
    await this.access.require(actor, "support");
    return actor.id;
  }
  async queue(token: string | undefined, filters: CaseFilters) {
    return this.port.queue(await this.actor(token), filters);
  }
  async detail(token: string | undefined, id: string, after?: string) {
    return this.port.detail(await this.actor(token), id, after);
  }
  async change(
    token: string | undefined,
    id: string,
    input: Parameters<SupportOperationsPort["change"]>[2],
    operationKey?: string,
  ) {
    return this.port.change(await this.actor(token), id, input, operationKey);
  }
  async reply(
    token: string | undefined,
    id: string,
    input: Parameters<SupportOperationsPort["reply"]>[2],
    operationKey?: string,
  ) {
    return this.port.reply(await this.actor(token), id, input, operationKey);
  }
}
