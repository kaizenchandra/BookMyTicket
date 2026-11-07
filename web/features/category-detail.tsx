import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function CategoryDetail({
  id,
  category,
}: {
  id: string;
  category: string;
}) {
  const [details, setDetails] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setDetails(null);
    setError("");
    api(`/catalog/${id}/${category}`)
      .then((r) => {
        if (current) setDetails(r.details);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [id, category]);
  if (error) return <p role="alert">{error}</p>;
  if (!details) return <p role="status">Loading category details…</p>;
  const keys =
    category === "cinema"
      ? [
          "durationMinutes",
          "releaseDate",
          "certification",
          "genre",
          "language",
          "format",
          "cast",
          "crew",
        ]
      : category === "events"
        ? [
            "performers",
            "organizer",
            "durationMinutes",
            "minimumAge",
            "genre",
            "language",
            "inclusions",
            "exclusions",
            "entryInstructions",
          ]
        : [
            "sport",
            "competition",
            "season",
            "homeTeam",
            "awayTeam",
            "entryInstructions",
            "hospitality",
          ];
  return (
    <dl>
      {keys.map((k) => (
        <div key={k}>
          <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
          <dd>
            {k === "minimumAge"
              ? details[k] === 0
                ? "All ages"
                : `${details[k]} years and above`
              : k === "durationMinutes"
                ? `${details[k]} minutes`
                : details[k]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
