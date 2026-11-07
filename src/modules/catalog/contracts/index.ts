import type { Transaction } from "../../../shared/database.ts";
export interface PublishedCatalog {
  requirePublished(id: string, tx?: Transaction): Promise<void>;
  requireOwnedPublished(
    id: string,
    organizationId: string,
    tx?: Transaction,
  ): Promise<void>;
}
export type ListingSummary = {
  id: string;
  title: string;
  kind: string;
  city: string;
  poster_url: string | null;
};
export interface FavoriteCatalog {
  requirePublished(id: string, tx?: Transaction): Promise<void>;
  summaries(ids: string[]): Promise<ListingSummary[]>;
}

export type CategoryDraftInput = {
  requestFingerprint?: string;
  title: string;
  city: string;
  description: string;
  posterUrl?: string;
  metadata: Record<string, string>;
};
export interface CategoryDrafts {
  write(
    tx: Transaction,
    actor: string,
    org: string,
    kind: "movie" | "sports" | "event",
    key: string,
    input: CategoryDraftInput,
    id?: string,
    version?: number,
  ): Promise<{
    id: string;
    version: number;
    state: string;
    replayed?: boolean;
  }>;
  owned(
    tx: Transaction,
    actor: string,
    org: string,
    id: string,
  ): Promise<{
    id: string;
    version: number;
    state: string;
    replayed?: boolean;
  }>;
}

export interface CatalogSessions {
  recordSession(
    tx: Transaction,
    input: {
      id: string;
      listingId: string;
      startsAt: string;
      timeZone: string;
      venueName: string;
      state: string;
    },
  ): Promise<void>;
}
