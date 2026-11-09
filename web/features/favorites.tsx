import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
export function SaveListing({
  id,
  accountId,
  signIn,
  collection = "favorites",
}: {
  collection?: "favorites" | "venue-favorites";
  id: string;
  accountId?: string;
  signIn: () => void;
}) {
  const [saved, setSaved] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0);
  const actor = useRef(accountId);
  actor.current = accountId;
  useEffect(() => {
    let current = true;
    setSaved(null);
    setMessage("");
    if (accountId)
      api<{ saved: boolean }>(`/${collection}/${id}`)
        .then((r) => {
          if (current) setSaved(r.saved);
        })
        .catch((e) => {
          if (current) setMessage(e.message);
        });
    return () => {
      current = false;
    };
  }, [id, accountId, collection, revision]);
  async function change(save: boolean) {
    const expected = accountId;
    setBusy(true);
    setMessage("");
    try {
      await api(`/${collection}/${id}`, {
        method: save ? "PUT" : "DELETE",
        ...(save ? { body: "{}" } : {}),
      });
      if (actor.current === expected) {
        setSaved(save);
        setMessage(save ? "Saved to Favorites." : "Removed from Favorites.");
      }
    } catch (e) {
      if (actor.current === expected) setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (pending && accountId && saved !== null && !busy) {
      setPending(false);
      if (!saved) void change(true);
    }
  }, [pending, accountId, saved, busy]);
  return (
    <div>
      <button
        aria-pressed={saved === true}
        disabled={busy || (!!accountId && saved === null)}
        onClick={() => {
          if (!accountId) {
            setPending(true);
            signIn();
          } else void change(!saved);
        }}
      >
        {busy
          ? "Saving…"
          : saved
            ? "Remove from Favorites"
            : "Save to Favorites"}
      </button>
      {message && <p role="status">{message}</p>}
      {accountId && saved === null && message && (
        <button onClick={() => setRevision((r) => r + 1)}>
          Retry favorite status
        </button>
      )}
    </div>
  );
}
type Favorite = {
  listingId: string;
  listing: null | {
    id: string;
    title: string;
    kind: string;
    city: string;
    poster_url: string | null;
  };
};
export function FavoritesPage({
  accountId,
  signIn,
}: {
  accountId?: string;
  signIn: () => void;
}) {
  const [items, setItems] = useState<Favorite[]>([]),
    [next, setNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const cursor = new URLSearchParams(location.search).get("after");
  useEffect(() => {
    let current = true;
    setItems([]);
    setMessage("");
    setLoading(true);
    if (!accountId) {
      setLoading(false);
      return;
    }
    api<{ items: Favorite[]; nextCursor: string | null }>(
      `/favorites${cursor ? "?after=" + encodeURIComponent(cursor) : ""}`,
    )
      .then((r) => {
        if (current) {
          setItems(r.items);
          setNext(r.nextCursor);
        }
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [accountId, cursor, revision]);
  if (!accountId)
    return (
      <section className="reading">
        <h1>Favorites</h1>
        <p>
          <a href="/favorites/venues">Saved venues</a>
        </p>
        <p>Sign in to access your saved movies, events and sports.</p>
        <button onClick={signIn}>Sign in</button>
      </section>
    );
  async function remove(id: string) {
    setBusy(id);
    try {
      await api(`/favorites/${id}`, { method: "DELETE" });
      setItems((old) => old.filter((f) => f.listingId !== id));
      setMessage("Removed from Favorites.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section>
      <p className="eyebrow">YOUR COLLECTION</p>
      <h1>Favorites</h1>
      <p>
        <a href="/favorites/venues">Saved venues</a>
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <p role="status">Loading favorites…</p>
      ) : !items.length ? (
        <p>
          No saved listings on this page. Browse Movies, Events or Sports to
          save one.
        </p>
      ) : (
        <div className="cards">
          {items.map((f) => (
            <article key={f.listingId} className="card">
              {f.listing ? (
                <>
                  <a href={`/listing/${f.listing.id}`}>
                    <h2>{f.listing.title}</h2>
                  </a>
                  <p>
                    {f.listing.kind} · {f.listing.city}
                  </p>
                </>
              ) : (
                <>
                  <h2>Listing unavailable</h2>
                  <p>This saved listing is no longer publicly available.</p>
                </>
              )}
              <button
                disabled={busy !== null}
                onClick={() => remove(f.listingId)}
              >
                {busy === f.listingId ? "Removing…" : "Remove"}
              </button>
            </article>
          ))}
        </div>
      )}
      <nav aria-label="Favorite pages">
        {cursor && <a href="/favorites">First page</a>}{" "}
        {next && (
          <a href={`/favorites?after=${encodeURIComponent(next)}`}>Next page</a>
        )}
      </nav>
      <button
        disabled={loading || busy !== null}
        onClick={() => setRevision((r) => r + 1)}
      >
        Refresh favorites
      </button>
    </section>
  );
}
