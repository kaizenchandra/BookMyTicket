import { AppError } from "../../../shared/errors.ts";
export type MovieDetails = {
  title: string;
  city: string;
  description: string;
  posterUrl?: string;
  durationMinutes: number;
  releaseDate: string;
  certification: string;
  genre: string;
  language: string;
  format: string;
  cast: string;
  crew: string;
};
export function validateMovie(m: MovieDetails) {
  if (
    !Number.isInteger(m.durationMinutes) ||
    m.durationMinutes < 1 ||
    m.durationMinutes > 600 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate) ||
    !Number.isFinite(Date.parse(m.releaseDate)) ||
    new Date(m.releaseDate).toISOString().slice(0, 10) !== m.releaseDate
  )
    throw new AppError(
      "INVALID_MOVIE",
      "Specify a valid duration and release date.",
      422,
    );
}
