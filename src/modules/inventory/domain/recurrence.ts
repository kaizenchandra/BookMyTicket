import { AppError } from "../../../shared/errors.ts";
export type Recurrence = {
  frequency: "daily" | "weekly";
  interval: number;
  count: number;
  excludeDates: string[];
};
export function expandRecurrence<
  T extends {
    startsAt: string;
    endsAt: string;
    salesOpen: string;
    salesClose: string;
  },
>(schedule: T, repeat: Recurrence): T[] {
  if (
    !["daily", "weekly"].includes(repeat.frequency) ||
    !Number.isInteger(repeat.interval) ||
    repeat.interval < 1 ||
    repeat.interval > 12 ||
    !Number.isInteger(repeat.count) ||
    repeat.count < 2 ||
    repeat.count > 24 ||
    new Set(repeat.excludeDates).size !== repeat.excludeDates.length
  )
    throw new AppError(
      "INVALID_RECURRENCE",
      "Choose 2–24 daily or weekly dates with a 1–12 interval and unique excluded dates.",
      422,
    );
  if (
    [schedule.startsAt, schedule.endsAt, schedule.salesClose].some(
      (value) => !/[+-]\d{2}:\d{2}$/.test(value),
    )
  )
    throw new AppError(
      "RECURRENCE_OFFSET_REQUIRED",
      "Recurring sessions require explicit venue-local UTC offsets for start, end and sales close.",
      422,
    );
  const step = repeat.interval * (repeat.frequency === "weekly" ? 7 : 1);
  if (step * (repeat.count - 1) > 366)
    throw new AppError(
      "INVALID_RECURRENCE",
      "A series must fit within 366 days.",
      422,
    );
  // Shift civil date while retaining the supplied offset. Application validates every result against the venue timezone.
  const shift = (value: string, days: number) => {
    const date = new Date(value.slice(0, 10) + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + days);
    if (!Number.isFinite(date.getTime()))
      throw new AppError("INVALID_RECURRENCE", "Invalid schedule date.", 422);
    return date.toISOString().slice(0, 10) + value.slice(10);
  };
  const candidates = Array.from({ length: repeat.count }, (_, i) => ({
    ...schedule,
    startsAt: shift(schedule.startsAt, i * step),
    endsAt: shift(schedule.endsAt, i * step),
    salesClose: shift(schedule.salesClose, i * step),
  }));
  if (
    repeat.excludeDates.some(
      (d) => !candidates.some((s) => s.startsAt.slice(0, 10) === d),
    )
  )
    throw new AppError(
      "INVALID_RECURRENCE",
      "Excluded dates must belong to the generated series.",
      422,
    );
  const result = candidates.filter(
    (s) => !repeat.excludeDates.includes(s.startsAt.slice(0, 10)),
  );
  if (!result.length)
    throw new AppError(
      "INVALID_RECURRENCE",
      "At least one session must remain.",
      422,
    );
  return result;
}
