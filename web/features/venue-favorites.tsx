import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
type Favorite = {
  venueId: string;
  venue: null | { id: string; name: string; city: string; address: string };
};
export function VenueFavoritesPage({
  accountId,
  signIn,
}: {
  accountId?: string;
  signIn: () => void;
}) {
  const [items, setItems] = useState<Favorite[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const cursor = new URLSearchParams(location.search).get("after");
  const actor = useRef(accountId);
  actor.current = accountId;
  useEffect(() => {
    let active = true;
    setItems([]);
    setNext(null);
    setError("");
    setMessage("");
    if (!accountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: Favorite[]; nextCursor: string | null }>(
      `/venue-favorites${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
    )
      .then((result) => {
        if (active) {
          setItems(result.items);
          setNext(result.nextCursor);
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
  }, [accountId, cursor, revision]);
  async function remove(id: string) {
    const expected = accountId;
    setBusy(id);
    setMessage("");
    try {
      await api(`/venue-favorites/${id}`, { method: "DELETE" });
      if (actor.current === expected) {
        setItems((old) => old.filter((f) => f.venueId !== id));
        setMessage("Venue removed from Favorites.");
      }
    } catch (e) {
      if (actor.current === expected) setMessage((e as Error).message);
    } finally {
      if (actor.current === expected) setBusy(null);
    }
  }
  return (
    <section className="reading">
      <h1>Saved venues</h1>
      <p>
        <a href="/favorites">Saved movies, events and sports</a>
      </p>
      {!accountId ? (
        <>
          <p>Sign in to see your saved venues.</p>
          <button onClick={signIn}>Sign in</button>
        </>
      ) : (
        <>
          {loading ? (
            <p role="status">Loading saved venues…</p>
          ) : error ? (
            <p role="alert">{error}</p>
          ) : !items.length ? (
            <p>
              No saved venues on this page. Open a venue from a listing's
              showtimes to save it.
            </p>
          ) : (
            items.map((f) => (
              <article key={f.venueId} className="organization">
                {f.venue ? (
                  <>
                    <h2>
                      <a href={`/venue/${f.venue.id}`}>{f.venue.name}</a>
                    </h2>
                    <p>{f.venue.city}</p>
                    <p>{f.venue.address}</p>
                  </>
                ) : (
                  <>
                    <h2>Venue unavailable</h2>
                    <p>This saved venue is no longer publicly available.</p>
                  </>
                )}
                <button
                  disabled={busy !== null}
                  onClick={() => remove(f.venueId)}
                >
                  {busy === f.venueId ? "Removing…" : "Remove venue"}
                </button>
              </article>
            ))
          )}
          {message && <p role="status">{message}</p>}
          <nav aria-label="Saved venue pages">
            {cursor && <a href="/favorites/venues">First page</a>}
            {!loading && !error && next && (
              <a href={`/favorites/venues?after=${encodeURIComponent(next)}`}>
                Next page
              </a>
            )}
          </nav>
          <button
            disabled={loading || busy !== null}
            onClick={() => setRevision((r) => r + 1)}
          >
            {error ? "Retry saved venues" : "Refresh saved venues"}
          </button>
        </>
      )}
    </section>
  );
}
