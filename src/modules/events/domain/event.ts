import { AppError } from "../../../shared/errors.ts";
export type EventDetails = {
  title: string;
  city: string;
  description: string;
  posterUrl?: string;
  performers: string;
  organizer: string;
  durationMinutes: number;
  minimumAge: number;
  genre: string;
  language: string;
  inclusions: string;
  exclusions: string;
  entryInstructions: string;
};
export function validateEvent(input: EventDetails) {
  if (
    !Number.isInteger(input.durationMinutes) ||
    input.durationMinutes < 1 ||
    input.durationMinutes > 1440 ||
    !Number.isInteger(input.minimumAge) ||
    input.minimumAge < 0 ||
    input.minimumAge > 100
  )
    throw new AppError(
      "INVALID_EVENT",
      "Specify a duration from 1 to 1440 minutes and a minimum age from 0 to 100.",
      422,
    );
}
