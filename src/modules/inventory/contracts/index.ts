import type { Transaction } from "../../../shared/database.ts";
export type ReservedSnapshot = {
  id: string;
  expires_at: Date;
  items: {
    occurrence_id: string;
    resource_id: string;
    quantity: number;
    unit_price_paise: number;
  }[];
  occurrences: {
    id: string;
    listingId: string;
    title?: string;
    isDemo?: boolean;
    venueName: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
  }[];
  subtotalPaise: number;
  currency: string;
};
export interface InventoryCommerce {
  snapshot(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
  ): Promise<ReservedSnapshot>;
  consume(
    tx: Transaction,
    ownerId: string,
    reservationId: string,
    options?: { requireActive: boolean },
  ): Promise<boolean>;
}
export interface AdmissionWindow {
  check(
    tx: Transaction,
    occurrenceId: string,
  ): Promise<"open" | "wrong_time" | "cancelled">;
}
export interface PolicyTarget {
  lockForPolicy(tx: Transaction, occurrenceId: string): Promise<void>;
}
export interface RegistrationTarget {
  lockForRegistration(
    tx: Transaction,
    occurrenceId: string,
  ): Promise<{ organizationId: string; state: string }>;
}

export type TicketOccurrence = {
  id: string;
  venueName: string;
  venueAddress: string | null;
  venueCity: string | null;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  state: string;
  version: number;
  resources: { id: string; label: string; gate?: string }[];
};
export interface TicketOccurrences {
  read(tx: Transaction, ids: string[]): Promise<TicketOccurrence[]>;
}

export interface PendingOrderRelease {
  release(tx: Transaction, owner: string, reservation: string): Promise<void>;
}

export interface FreeCancellationInventory {
  inspect(
    tx: Transaction,
    owner: string,
    reservation: string,
    cutoffMinutes: number,
  ): Promise<{
    fingerprint: string;
    quantity: number;
    expiresAt: Date;
    items: {
      occurrenceId: string;
      resourceId: string;
      label: string;
      quantity: number;
    }[];
  }>;
  release(tx: Transaction, owner: string, reservation: string): Promise<void>;
}
