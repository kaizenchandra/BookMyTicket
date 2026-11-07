export interface CasesPort {
  create(
    ownerId: string,
    subject: string,
    category: string,
    body: string,
  ): Promise<unknown>;
  list(ownerId: string): Promise<unknown>;
  queue(): Promise<unknown>;
  messages(actorId: string, caseId: string, staff: boolean): Promise<unknown>;
  reply(
    actorId: string,
    caseId: string,
    body: string,
    audience: "customer" | "internal",
    staff: boolean,
  ): Promise<unknown>;
}
