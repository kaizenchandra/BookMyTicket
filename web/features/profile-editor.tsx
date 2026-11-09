import { useEffect, useState } from "react";
import { api, ApiError } from "../api.ts";
type Details = {
  name: string;
  theme: "LIGHT" | "DARK";
  city: string | null;
  version: number;
};
export function ProfileEditor() {
  const [saved, setSaved] = useState<Details | null>(null),
    [name, setName] = useState(""),
    [city, setCity] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [conflict, setConflict] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<Details>("/profile")
      .then((p) => {
        if (active) {
          setSaved(p);
          setName(p.name);
          setCity(p.city ?? "");
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
  return (
    <section aria-label="Profile details">
      {loading && <p role="status">Loading profile…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {saved && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const p = await api<Details>("/profile", {
                method: "PUT",
                body: JSON.stringify({
                  name: name.trim(),
                  city: city.trim() || null,
                  theme: saved.theme,
                  expectedVersion: saved.version,
                }),
              });
              setSaved(p);
              setName(p.name);
              setCity(p.city ?? "");
              setMessage(
                "Profile saved. Your preferred city is used when no city is selected for this device or page.",
              );
            } catch (e) {
              setError((e as Error).message);
              if (e instanceof ApiError && e.status === 409) setConflict(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            Preferred city
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              maxLength={100}
            />
          </label>
          <p>
            Optional. Clear this field to remove your account preference. A city
            selected in the URL or on this device takes precedence.
          </p>
          <button disabled={loading || busy || conflict}>Save profile</button>
        </form>
      )}
      {conflict && (
        <p>
          Your draft has been kept. Copy any changes you want to retain before
          loading the latest saved profile.
        </p>
      )}
      {(error || conflict) && (
        <button
          disabled={loading || busy}
          onClick={() => setRevision((r) => r + 1)}
        >
          {saved
            ? "Discard draft and load latest profile"
            : "Retry loading profile"}
        </button>
      )}
      {saved?.city && (
        <p>
          <a href={`/explore?city=${encodeURIComponent(saved.city)}`}>
            Browse {saved.city} now
          </a>
        </p>
      )}
    </section>
  );
}
