export type CustomerCaseFilters = {
  caseId?: string;
  after?: string;
  bookingId?: string;
  state?: "open" | "in_progress" | "escalated" | "resolved";
  category?: "booking" | "payment" | "accessibility" | "other";
};
export interface CasesPort {
  create(
    ownerId: string,
    subject: string,
    category: string,
    body: string,
    bookingId?: string,
    operationKey?: string,
  ): Promise<unknown>;
  list(ownerId: string, filters?: CustomerCaseFilters): Promise<unknown>;
  queue(): Promise<unknown>;
  messages(
    actorId: string,
    caseId: string,
    staff: boolean,
    after?: string,
  ): Promise<unknown>;
  reply(
    actorId: string,
    caseId: string,
    body: string,
    audience: "customer" | "internal",
    staff: boolean,
    operationKey?: string,
  ): Promise<unknown>;
}
