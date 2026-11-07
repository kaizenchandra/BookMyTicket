import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
export function CategoryEditor({
  org,
  onSaved,
  onDirty,
}: {
  org: string;
  onSaved: () => void;
  onDirty: () => void;
}) {
  const [category, setCategory] = useState("cinema"),
    [rows, setRows] = useState<any[]>([]),
    [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [dirty, setDirty] = useState(false);
  const operation = useRef({ body: "", key: crypto.randomUUID() });
  useEffect(() => {
    let active = true;
    setRows([]);
    api(`/organizations/${org}/${category}`)
      .then((r) => {
        if (active) setRows(r.items);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [org, category, revision]);
  const fields =
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
    <details>
      <summary>Cinema movies and sports fixtures</summary>
      <label>
        Category
        <select
          value={category}
          disabled={busy}
          onChange={(e) => {
            if (dirty && !window.confirm("Discard unsaved category details?"))
              return;
            setCategory(e.target.value);
            setEditing(null);
            setDirty(false);
          }}
        >
          <option value="cinema">Cinema</option>
          <option value="sports">Sports</option>
        </select>
      </label>
      <p>
        Save a draft, then submit it for moderation below. Published listings
        use the shared venues, seating and scheduling controls.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <form
        key={`${category}:${editing?.id ?? "new"}:${revision}`}
        onChange={() => {
          setDirty(true);
          onDirty();
        }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const values = Object.fromEntries(new FormData(e.currentTarget));
          if (!values.posterUrl) delete values.posterUrl;
          const input: any = {
              ...values,
              ...(category === "cinema"
                ? { durationMinutes: Number(values.durationMinutes) }
                : {}),
              ...(editing ? { version: editing.version } : {}),
            },
            body = JSON.stringify(input);
          if (operation.current.body !== body)
            operation.current = { body, key: crypto.randomUUID() };
          try {
            await api(
              `/organizations/${org}/${category}${editing ? "/" + editing.id : ""}`,
              {
                method: editing ? "PUT" : "POST",
                body,
                headers: { "idempotency-key": operation.current.key },
              },
            );
            setMessage(
              "Category draft saved. Submit it for moderation in the catalog list.",
            );
            setEditing(null);
            setDirty(false);
            setRevision((r) => r + 1);
            onSaved();
          } catch (err) {
            setMessage((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>
          {editing ? "Edit" : "Create"}{" "}
          {category === "cinema" ? "movie" : "fixture"}
        </h3>
        {["title", "city", "description", "posterUrl", ...fields].map(
          (field) => (
            <label key={field}>
              {field.replace(/([A-Z])/g, " $1")}
              {field === "posterUrl" ? " (optional HTTPS URL)" : ""}
              {field === "certification" ? (
                <select
                  name={field}
                  defaultValue={editing?.details[field] ?? "U"}
                >
                  {[
                    "U",
                    "UA 7+",
                    "UA 13+",
                    "UA 16+",
                    "A",
                    "S",
                    "Unrated (demo)",
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  name={field}
                  type={
                    field === "durationMinutes"
                      ? "number"
                      : field === "releaseDate"
                        ? "date"
                        : "text"
                  }
                  min={field === "durationMinutes" ? 1 : undefined}
                  max={field === "durationMinutes" ? 600 : undefined}
                  maxLength={field === "description" ? 10000 : 2000}
                  required={field !== "posterUrl"}
                  defaultValue={editing?.details[field] ?? ""}
                />
              )}
            </label>
          ),
        )}
        <button disabled={busy}>Save category draft</button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setDirty(false);
            }}
          >
            Create another
          </button>
        )}
      </form>
      {rows.map((r) => (
        <article className="organization" key={r.id}>
          <strong>{r.details.title}</strong>
          <p>
            {r.state} · version {r.version}
          </p>
          {["draft", "changes_requested"].includes(r.state) && (
            <button
              disabled={busy}
              onClick={() => {
                if (
                  dirty &&
                  !window.confirm("Discard unsaved category details?")
                )
                  return;
                setEditing(r);
                setDirty(false);
              }}
            >
              Edit category details
            </button>
          )}
        </article>
      ))}
    </details>
  );
}
