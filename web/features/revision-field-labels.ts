const labels: Record<string, string> = {
  title: "Title",
  description: "Description",
  city: "City",
  kind: "Listing type",
  state: "Saved state",
  language: "Language",
  genre: "Genre",
  format: "Format",
  certification: "Certification",
  duration: "Duration",
  performers: "Cast / performers",
  releaseDate: "Release date",
  sport: "Sport",
  competition: "Competition",
  teams: "Teams",
  entryInstructions: "Entry instructions",
  minimumAge: "Minimum age",
  crew: "Crew",
  season: "Season",
  homeTeam: "Home team",
  awayTeam: "Away team",
  hospitality: "Hospitality",
  organizer: "Organizer",
  inclusions: "Inclusions",
  exclusions: "Exclusions",
};
export function revisionFieldLabel(field: string) {
  const key = field.replace(/^categoryDetails\./, "");
  return Object.hasOwn(labels, key) ? labels[key] : field;
}
