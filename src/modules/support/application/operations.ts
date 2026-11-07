import type { Access } from "../../identity/contracts/index.ts";
import type { CaseAction, Priority } from "../domain/workflow.ts";
export type CaseFilters = {
  state?: string;
  priority?: string;
  category?: string;
  assignment?: string;
};
export interface SupportOperationsPort {
  queue(actor: string, filters: CaseFilters): Promise<unknown>;
  detail(actor: string, id: string): Promise<unknown>;
  change(
    actor: string,
    id: string,
    input: {
      version: number;
      action: CaseAction;
      priority?: Priority;
      reason: string;
    },
  ): Promise<unknown>;
  reply(
    actor: string,
    id: string,
    input: { version: number; audience: "customer" | "internal"; body: string },
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
  async detail(token: string | undefined, id: string) {
    return this.port.detail(await this.actor(token), id);
  }
  async change(
    token: string | undefined,
    id: string,
    input: Parameters<SupportOperationsPort["change"]>[2],
  ) {
    return this.port.change(await this.actor(token), id, input);
  }
  async reply(
    token: string | undefined,
    id: string,
    input: Parameters<SupportOperationsPort["reply"]>[2],
  ) {
    return this.port.reply(await this.actor(token), id, input);
  }
}
