import { AppError } from "../../../shared/errors.ts";
export type FixtureDetails = {
  title: string;
  city: string;
  description: string;
  posterUrl?: string;
  sport: string;
  competition: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  entryInstructions: string;
  hospitality: string;
};
export function validateFixture(f: FixtureDetails) {
  if (f.homeTeam.trim().toLowerCase() === f.awayTeam.trim().toLowerCase())
    throw new AppError(
      "INVALID_FIXTURE",
      "A fixture must have different participants.",
      422,
    );
}
