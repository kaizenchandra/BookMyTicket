import type { TicketOccurrence } from "../../inventory/contracts/index.ts";
export type WalletView = {
  orderId: string;
  bookingState: string;
  serverTime: string;
  issuance: "not_confirmed" | "pending" | "issued";
  instructions: string;
  occurrences: (TicketOccurrence & {
    directionsUrl: string | null;
    admissionOpensAt: string;
    scheduleChanged: boolean;
  })[];
  items: {
    id: string;
    occurrenceId: string;
    resource: string;
    label: string;
    gate: string | null;
    ordinal: number;
    status: string;
    remaining: number;
    qrSvg: string | null;
  }[];
};
