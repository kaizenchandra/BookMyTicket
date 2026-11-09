import { useEffect, useState, useRef } from "react";
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
  const formEdits = useRef(0);
  const [creationAttempt, setCreationAttempt] = useState<{
    org: string;
    body: string;
    key: string;
    formRevision: number;
  } | null>(null);
  const [draftAttempt, setDraftAttempt] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const [editing, setEditing] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [reset, setReset] = useState(0),
    [submissionAttempt, setSubmissionAttempt] = useState<{
      id: string;
      version: number;
    } | null>(null);
  useEffect(() => {
    const clear = () => {
      setCreationAttempt(null);
      setDraftAttempt(null);
      setSubmissionAttempt(null);
      setMessage("");
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  async function retryCreation() {
    if (busy || !creationAttempt) return;
    if (
      formEdits.current !== creationAttempt.formRevision &&
      !window.confirm(
        "Retry the original creation and reset the form? Changes made since that attempt will be discarded.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api(
        `/organizations/${creationAttempt.org}/listings`,
        {
          method: "POST",
          headers: { "idempotency-key": creationAttempt.key },
          body: creationAttempt.body,
        },
      );
      setCreationAttempt(null);
      setEditing(null);
      setReset((r) => r + 1);
      onSaved();
      setMessage(
        `Original creation recorded for listing ${result.id}. Check its refreshed status before editing.`,
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retryDraft() {
    if (busy || !draftAttempt) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await api(`/listings/${draftAttempt.id}`, {
        method: "PUT",
        body: draftAttempt.body,
      });
      setDraftAttempt(null);
      if (editing?.id === draftAttempt.id)
        setEditing({ ...editing, version: result.version });
      onSaved();
      onDirty();
      setMessage(
        "Original draft save recorded. Your form is retained; check refreshed listing status before saving further changes.",
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submitListing(listing: { id: string; version: number }) {
    if (busy) return;
    setSubmissionAttempt({ id: listing.id, version: listing.version });
    setBusy(true);
    setMessage("");
    try {
      await api(`/listings/${listing.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ version: listing.version }),
      });
      setSubmissionAttempt(null);
      onSaved();
      setMessage(
        "Submission recorded for the selected version. Refreshing current review status.",
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
      {submissionAttempt && !busy && (
        <section aria-label="Recover listing submission">
          <p>
            A submission response may have been lost. Retry the original listing
            version safely; later reviews are never reversed. Current editing
            access is still required.
          </p>
          <p>
            Listing reference: {submissionAttempt.id} · submitted version{" "}
            {submissionAttempt.version}
          </p>
          <button onClick={() => void submitListing(submissionAttempt)}>
            Retry original submission
          </button>
          <button onClick={() => setSubmissionAttempt(null)}>
            Dismiss retry
          </button>
        </section>
      )}
      {draftAttempt && !busy && (
        <section aria-label="Recover draft edit">
          <p>
            Retry the original saved payload if its response was lost. This
            ignores later form edits and never overwrites newer server changes.
            Your current form will be retained.
          </p>
          <p>Listing reference: {draftAttempt.id}</p>
          <button onClick={() => void retryDraft()}>
            Retry original draft save
          </button>
          <button onClick={() => setDraftAttempt(null)}>
            Dismiss draft retry
          </button>
        </section>
      )}
      {creationAttempt && !busy && (
        <section aria-label="Recover listing creation">
          <p>
            The original creation may already have succeeded. Retry with the
            same key and content to recover its listing instead of creating
            another. Check current listings before clearing recovery.
          </p>
          <button onClick={() => void retryCreation()}>
            Retry original creation
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  "A draft may already exist. Have you checked current listings before clearing this recovery attempt?",
                )
              )
                setCreationAttempt(null);
            }}
          >
            Clear creation recovery
          </button>
        </section>
      )}
      <form
        key={`${editing?.id ?? "new"}-${reset}`}
        onChange={() => {
          formEdits.current++;
          onDirty();
        }}
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
          if (busy) return;
          const body = JSON.stringify(input);
          if (
            !editing &&
            creationAttempt &&
            (creationAttempt.org !== org || creationAttempt.body !== body)
          ) {
            setMessage(
              "Resolve the original creation attempt before saving different new listing content.",
            );
            return;
          }
          const createAttempt = !editing
            ? (creationAttempt ?? {
                org,
                body,
                key: crypto.randomUUID(),
                formRevision: formEdits.current,
              })
            : null;
          if (createAttempt) setCreationAttempt(createAttempt);
          if (editing) setDraftAttempt({ id: editing.id, body });
          setBusy(true);
          setMessage("");
          try {
            await api(
              editing
                ? `/listings/${editing.id}`
                : `/organizations/${org}/listings`,
              {
                method: editing ? "PUT" : "POST",
                body,
                ...(createAttempt
                  ? { headers: { "idempotency-key": createAttempt.key } }
                  : {}),
              },
            );
            if (!editing) setCreationAttempt(null);
            setDraftAttempt(null);
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
        <fieldset disabled={busy}>
          <legend>Listing draft fields</legend>
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
                  setDraftAttempt(null);
                setEditing(null);
              }}
            >
              Cancel editing
            </button>
          )}
        </fieldset>
      </form>
      {!listings.length ? (
        <p>No catalog drafts yet.</p>
      ) : (
        listings.map((l) => (
          <article className="organization" key={l.id}>
            <h3>{l.title}</h3>
            <a href={`/partner/listing-history?listingId=${l.id}`}>
              View moderation reasons and decisions
            </a>
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
                    ) {
                      formEdits.current++;
                      setEditing(l);
                    }
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
