import { useEffect, useState } from "react";
import { api, ApiError } from "../api.ts";
import type { SavedAttendee } from "../../src/modules/profiles/application/saved-attendees.ts";
type Saved = {
  version: number;
  consentVersion: 1;
  consent: boolean;
  items: SavedAttendee[];
};
export function SavedAttendeesEditor() {
  const [saved, setSaved] = useState<Saved | null>(null),
    [items, setItems] = useState<SavedAttendee[]>([]),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [conflict, setConflict] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Saved>("/profile/attendees")
      .then((s) => {
        if (active) {
          setSaved(s);
          setItems(s.items);
          setConsent(false);
          setConflict(false);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  const update = (next: SavedAttendee[]) => {
    setItems(next);
    setConsent(false);
  };
  async function save(withdraw = false) {
    if (!saved) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const s = await api<Saved>("/profile/attendees", {
        method: "PUT",
        body: JSON.stringify({
          expectedVersion: saved.version,
          consentVersion: 1,
          consent: withdraw ? false : consent,
          items: withdraw ? [] : items,
        }),
      });
      setSaved(s);
      setItems(s.items);
      setConsent(false);
      setMessage(
        withdraw
          ? "Consent withdrawn and saved details removed. Existing booking records are unchanged."
          : "Saved attendee details updated.",
      );
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiError && e.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Saved attendee details">
      <h2>Saved attendees</h2>
      <p>
        Optional private shortcuts for booking forms. Save only details you are
        authorized to store. These are not verified contacts and do not
        subscribe anyone to marketing. Removing this list does not erase
        information already accepted with a booking.
      </p>
      {loading && <p role="status">Loading saved attendees…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {saved && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {items.map((item, index) => (
            <fieldset key={item.id} disabled={busy || loading || conflict}>
              <legend>Attendee {index + 1}</legend>
              {(["name", "email", "phone"] as const).map((field) => (
                <label key={field}>
                  {field === "phone"
                    ? "Phone with country code (optional)"
                    : field === "email"
                      ? "Email (optional)"
                      : "Name"}
                  <input
                    type={
                      field === "email"
                        ? "email"
                        : field === "phone"
                          ? "tel"
                          : "text"
                    }
                    required={field === "name"}
                    maxLength={
                      field === "name" ? 100 : field === "email" ? 254 : 16
                    }
                    value={item[field]}
                    onChange={(e) =>
                      update(
                        items.map((i) =>
                          i.id === item.id
                            ? { ...i, [field]: e.target.value }
                            : i,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => update(items.filter((i) => i.id !== item.id))}
              >
                Remove attendee {index + 1}
              </button>
            </fieldset>
          ))}
          {!items.length && <p>No attendee shortcuts saved.</p>}
          <button
            type="button"
            disabled={busy || loading || conflict || items.length >= 10}
            onClick={() =>
              update([
                ...items,
                { id: crypto.randomUUID(), name: "", email: "", phone: "" },
              ])
            }
          >
            Add attendee
          </button>
          {!!items.length && (
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I consent to storing these details in my account for reuse in
              future booking forms (policy version 1).
            </label>
          )}
          <button
            disabled={
              busy || loading || conflict || (items.length > 0 && !consent)
            }
          >
            {busy ? "Saving…" : "Save attendee list"}
          </button>
          {saved.consent && (
            <button
              type="button"
              disabled={busy || loading || conflict}
              onClick={() => void save(true)}
            >
              Withdraw consent and delete all saved details
            </button>
          )}
        </form>
      )}
      {conflict && (
        <p>
          Your draft is preserved. Copy any changes before discarding it and
          loading the latest list.
        </p>
      )}
      {error && (
        <button
          disabled={busy || loading}
          onClick={() => setRevision((r) => r + 1)}
        >
          {saved ? "Discard draft and reload list" : "Retry loading attendees"}
        </button>
      )}
    </section>
  );
}
export function SavedAttendeeValue({
  items,
  type,
  disabled,
  onChoose,
}: {
  items: SavedAttendee[];
  type: string;
  disabled: boolean;
  onChoose: (value: string) => void;
}) {
  const field =
    type === "email" ? "email" : type === "phone" ? "phone" : "name";
  if (!["text", "email", "phone"].includes(type)) return null;
  return (
    <label>
      Use a saved {field} for this field
      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          const item = items.find((i) => i.id === e.target.value);
          if (item) onChoose(item[field]);
        }}
      >
        <option value="">Choose saved {field}</option>
        {items
          .filter((i) => i[field])
          .map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}: {i[field]}
            </option>
          ))}
      </select>
    </label>
  );
}
