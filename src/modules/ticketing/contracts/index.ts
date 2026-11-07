import type { Transaction } from "../../../shared/database.ts";
export interface TicketIssuer {
  issue(
    tx: Transaction,
    orderId: string,
    ownerId: string,
    items: { occurrence_id: string; resource_id: string; quantity: number }[],
  ): Promise<void>;
}

export type OwnedTicket = {
  id: string;
  occurrenceId: string;
  resource: string;
  ordinal: number;
  state: string;
  remaining: number;
  token?: string;
};
export interface TicketReader {
  list(
    ownerId: string,
    orderId: string,
    tx?: Transaction,
    credentialOccurrences?: string[],
  ): Promise<OwnedTicket[]>;
}
export interface TicketCodeRenderer {
  svg(token: string): Promise<string>;
}

export interface UnusedTicketCancellation {
  inspect(tx: Transaction, order: string, quantity: number): Promise<string[]>;
  revoke(tx: Transaction, ids: string[]): Promise<void>;
}
