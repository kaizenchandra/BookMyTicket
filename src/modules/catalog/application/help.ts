import type { helpDestinations } from "../domain/help.ts";
import {
  searchHelp,
  type HelpArticle,
  type HelpTopic,
} from "../domain/help.ts";
export interface HelpContent {
  published(): readonly HelpArticle[] | Promise<readonly HelpArticle[]>;
}
export class Help {
  constructor(private content: HelpContent) {}
  async search(q?: string, topic?: HelpTopic) {
    return { items: searchHelp(await this.content.published(), q, topic) };
  }
}

export type HelpEdit = {
  question: string;
  answer: string;
  topic: HelpTopic;
  published: boolean;
  version: number;
  reason: string;
};
export type HelpCreation = {
  id: string;
  question: string;
  answer: string;
  topic: HelpTopic;
  destination: keyof typeof helpDestinations;
  reason: string;
};
export type HelpAdminFilters = {
  after?: string;
  q?: string;
  status?: "all" | "published" | "unpublished";
};
export interface HelpEditorStore {
  create(actor: string, input: HelpCreation): Promise<unknown>;
  list(actor: string, filters?: HelpAdminFilters): Promise<unknown>;
  history(actor: string, id: string, beforeVersion?: number): Promise<unknown>;
  save(actor: string, id: string, input: HelpEdit): Promise<unknown>;
}
export class HelpEditor {
  constructor(private store: HelpEditorStore) {}
  create(actor: string, input: HelpCreation) {
    return this.store.create(actor, input);
  }
  list(actor: string, filters: HelpAdminFilters = {}) {
    return this.store.list(actor, filters);
  }
  history(actor: string, id: string, beforeVersion?: number) {
    return this.store.history(actor, id, beforeVersion);
  }
  save(actor: string, id: string, input: HelpEdit) {
    return this.store.save(actor, id, input);
  }
}
