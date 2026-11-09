export const categoryRevisionFields = [
  "language",
  "genre",
  "format",
  "certification",
  "duration",
  "performers",
  "releaseDate",
  "sport",
  "competition",
  "teams",
  "entryInstructions",
  "minimumAge",
  "crew",
  "season",
  "homeTeam",
  "awayTeam",
  "hospitality",
  "organizer",
  "inclusions",
  "exclusions",
] as const;
export type CategoryRevisionField = (typeof categoryRevisionFields)[number];
export const categoryRevisionFieldsByKind: Record<
  string,
  readonly CategoryRevisionField[]
> = {
  movie: [
    "language",
    "genre",
    "format",
    "certification",
    "duration",
    "performers",
    "releaseDate",
    "crew",
  ],
  event: [
    "language",
    "genre",
    "duration",
    "performers",
    "minimumAge",
    "organizer",
    "inclusions",
    "exclusions",
    "entryInstructions",
  ],
  sports: [
    "sport",
    "competition",
    "teams",
    "entryInstructions",
    "season",
    "homeTeam",
    "awayTeam",
    "hospitality",
  ],
};
const coreFields = ["title", "description", "city", "kind", "state"] as const;
export type SafeRevisionSnapshot = Record<
  (typeof coreFields)[number],
  string | null
> & { categoryDetails: Partial<Record<CategoryRevisionField, string | null>> };
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(source: Record<string, unknown>, field: string): string | null {
  return Object.hasOwn(source, field) && typeof source[field] === "string"
    ? (source[field] as string)
    : null;
}
export function projectRevisionSnapshot(value: unknown): SafeRevisionSnapshot {
  const source = record(value),
    metadata = record(source.metadata);
  const core = Object.fromEntries(
    coreFields.map((field) => [field, text(source, field)]),
  ) as Record<(typeof coreFields)[number], string | null>;
  const fields = Object.hasOwn(categoryRevisionFieldsByKind, core.kind ?? "")
    ? categoryRevisionFieldsByKind[core.kind!]
    : [];
  return {
    ...core,
    categoryDetails: Object.fromEntries(
      fields.map((field) => [field, text(metadata, field)]),
    ),
  };
}
