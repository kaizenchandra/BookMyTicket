import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function CatalogEditor({
  org,
  listings,
  onSaved,
  onDirty,
}: {
  org: string;
  listings: any[];
  onSaved: () => void;
  onDirty: () => void;
}) {
  const [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reset, setReset] = useState(0);
  async function submitListing(listing: any) {
    setBusy(true);
    setMessage("");
    try {
      await api(`/listings/${listing.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ version: listing.version }),
      });
      onSaved();
      setMessage(
        "Submitted for moderation. The listing is not published until approved.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Create, edit and submit catalog drafts</summary>
      <p>
        Draft content is private to your organization. Submitting a revision
        does not publish it.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <form
        key={`${editing?.id ?? "new"}-${reset}`}
        onChange={onDirty}
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form),
            get = (k: string) => String(f.get(k) ?? "");
          const metadata: Record<string, string> = {
            ...(editing?.metadata ?? {}),
          };
          for (const k of [
            "genre",
            "language",
            "format",
            "certification",
            "duration",
            "performers",
            "teams",
            "entryInstructions",
          ]) {
            const value = get(k);
            if (value) metadata[k] = value;
            else delete metadata[k];
          }
          const input = {
            title: get("title"),
            kind: get("kind"),
            city: get("city"),
            description: get("description"),
            ...(get("posterUrl") ? { posterUrl: get("posterUrl") } : {}),
            metadata,
            ...(editing ? { version: editing.version } : {}),
          };
          setBusy(true);
          setMessage("");
          try {
            await api(
              editing
                ? `/listings/${editing.id}`
                : `/organizations/${org}/listings`,
              { method: editing ? "PUT" : "POST", body: JSON.stringify(input) },
            );
            setEditing(null);
            setReset((r) => r + 1);
            setMessage("Draft saved. Review the preview before submitting.");
            onSaved();
          } catch (error) {
            setMessage((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h3>{editing ? "Edit draft" : "New listing"}</h3>
        <label>
          Title
          <input
            name="title"
            defaultValue={editing?.title ?? ""}
            required
            minLength={2}
            maxLength={200}
          />
        </label>
        <label>
          Category
          <select name="kind" defaultValue={editing?.kind ?? "movie"}>
            <option value="movie">Movie</option>
            <option value="event">Event</option>
            <option value="sports">Sports</option>
          </select>
        </label>
        <label>
          City
          <input
            name="city"
            defaultValue={editing?.city ?? ""}
            required
            minLength={2}
            maxLength={100}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={editing?.description ?? ""}
            required
            minLength={10}
            maxLength={10000}
          />
        </label>
        <label>
          Licensed poster URL (HTTPS, optional)
          <input
            name="posterUrl"
            type="url"
            defaultValue={editing?.poster_url ?? ""}
          />
        </label>
        {[
          ["genre", "Genre"],
          ["language", "Language"],
          ["format", "Format"],
          ["certification", "Certification"],
          ["duration", "Duration"],
          ["performers", "Cast / performers"],
          ["teams", "Teams / participants"],
          ["entryInstructions", "Entry instructions"],
        ].map(([name, label]) => (
          <label key={name}>
            {label} (when applicable)
            <input
              name={name}
              maxLength={1000}
              defaultValue={editing?.metadata?.[name] ?? ""}
            />
          </label>
        ))}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save draft"}
        </button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Discard unsaved draft edits?"))
                setEditing(null);
            }}
          >
            Cancel editing
          </button>
        )}
      </form>
      {!listings.length ? (
        <p>No catalog drafts yet.</p>
      ) : (
        listings.map((l) => (
          <article className="organization" key={l.id}>
            <h3>{l.title}</h3>
            <p>
              {l.kind} · {l.state} · version {l.version}
            </p>
            <details>
              <summary>Saved customer-content preview</summary>
              {l.poster_url && (
                <img
                  src={l.poster_url}
                  alt={`${l.title} poster`}
                  style={{ width: 160, maxWidth: "100%" }}
                />
              )}
              <h4>{l.title}</h4>
              <p>{l.description}</p>
              <p>{l.city}</p>
              <dl>
                {Object.entries(l.metadata as Record<string, string>).map(
                  ([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ),
                )}
              </dl>
              <p>Private preview — this is not a published booking page.</p>
            </details>
            {["draft", "changes_requested"].includes(l.state) && (
              <>
                <button
                  disabled={busy || !!l.metadata.managedBy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Open this saved draft? Unsaved edits will be discarded.",
                      )
                    )
                      setEditing(l);
                  }}
                >
                  {l.metadata.managedBy
                    ? "Use category editor above"
                    : "Edit draft"}
                </button>
                <button disabled={busy} onClick={() => submitListing(l)}>
                  Submit for moderation
                </button>
              </>
            )}
            {l.state === "published" && (
              <a href={`/listing/${l.id}`}>View published listing</a>
            )}
          </article>
        ))
      )}
    </details>
  );
}
