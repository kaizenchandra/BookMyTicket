import { validateMovie, type MovieDetails } from "../domain/movie.ts";
export interface MoviesPort {
  save(
    actor: string,
    org: string,
    key: string,
    input: MovieDetails,
    id?: string,
    version?: number,
  ): Promise<unknown>;
  list(actor: string, org: string): Promise<unknown>;
  detail(id: string): Promise<unknown>;
}
export class Movies {
  constructor(private port: MoviesPort) {}
  save(
    actor: string,
    org: string,
    key: string,
    input: MovieDetails,
    id?: string,
    version?: number,
  ) {
    validateMovie(input);
    return this.port.save(actor, org, key, input, id, version);
  }
  list(actor: string, org: string) {
    return this.port.list(actor, org);
  }
  detail(id: string) {
    return this.port.detail(id);
  }
}
