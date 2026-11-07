export type CatalogFilters = {
  city?: string;
  kind?: "movie" | "event" | "sports";
  q?: string;
  after?: string;
  language?: string;
  genre?: string;
  format?: string;
  sort?: "newest" | "title";
};
export interface CatalogPort {
  search(filters: CatalogFilters): Promise<unknown>;
  suggestions(q: string, city?: string): Promise<unknown>;
  detail(id: string): Promise<unknown>;
}
export class Discovery {
  constructor(private port: CatalogPort) {}
  search(filters: CatalogFilters) {
    return this.port.search(filters);
  }
  suggestions(q: string, city?: string) {
    return this.port.suggestions(q, city);
  }
  detail(id: string) {
    return this.port.detail(id);
  }
}
