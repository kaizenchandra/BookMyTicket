import { RequestScope } from "../request-scope.ts";
import type { FavoritePage } from "../../src/modules/profiles/adapters/favorites-schema.ts";
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
  const [savedValue, setSaved] = useState<boolean | null>(null),
    [statusScope, setStatusScope] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const scope = useRef(new RequestScope()).current;
  const resource = JSON.stringify([collection, id]);
  const scopeKey = JSON.stringify([accountId, collection, id]);
  scope.update(scopeKey);
  const saved = statusScope === scopeKey ? savedValue : null;
  useEffect(() => () => scope.invalidate(), [scope]);
  useEffect(() => {
    const current = scope.capture();
    setBusy(false);
    setSaved(null);
    setMessage("");
    if (accountId)
      api<{ saved: boolean }>(`/${collection}/${id}`)
        .then((r) => {
          if (current()) {
            setSaved(r.saved);
            setStatusScope(scopeKey);
          }
        })
        .catch((e) => {
          if (current()) setMessage(e.message);
        });
    return () => scope.invalidate();
  }, [id, accountId, collection, revision]);
  async function change(save: boolean) {
    const current = scope.capture();
    setBusy(true);
    setMessage("");
    try {
      await api(`/${collection}/${id}`, {
        method: save ? "PUT" : "DELETE",
        ...(save ? { body: "{}" } : {}),
      });
      if (current()) {
        setSaved(save);
        setMessage(save ? "Saved to Favorites." : "Removed from Favorites.");
      }
    } catch (e) {
      if (current()) setMessage((e as Error).message);
    } finally {
      if (current()) setBusy(false);
    }
  }
  useEffect(() => {
    if (pending && pending !== resource) setPending(null);
    if (pending === resource && accountId && saved !== null && !busy) {
      setPending(null);
      if (!saved) void change(true);
    }
  }, [pending, resource, accountId, saved, busy]);
  return (
    <div>
      <button
        aria-pressed={saved === true}
        disabled={busy || (!!accountId && saved === null)}
        onClick={() => {
          if (!accountId) {
            setPending(resource);
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
type Favorite = FavoritePage["items"][number];
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
    [error, setError] = useState(""),
    [loadedScope, setLoadedScope] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const cursor = new URLSearchParams(location.search).get("after");
  const scope = useRef(new RequestScope()).current;
  const scopeKey = JSON.stringify([accountId, cursor, revision]);
  scope.update(scopeKey);
  const awaitingPage = loading || loadedScope !== scopeKey;
  useEffect(() => () => scope.invalidate(), [scope]);
  useEffect(() => {
    const current = scope.capture();
    setItems([]);
    setNext(null);
    setBusy(null);
    setError("");
    setMessage("");
    setLoading(true);
    if (!accountId) {
      setLoading(false);
      return;
    }
    api<FavoritePage>(
      `/favorites${cursor ? "?after=" + encodeURIComponent(cursor) : ""}`,
    )
      .then((r) => {
        if (current()) {
          setItems(r.items);
          setNext(r.nextCursor);
        }
      })
      .catch((e) => {
        if (current()) setError(e.message);
      })
      .finally(() => {
        if (current()) {
          setLoading(false);
          setLoadedScope(scopeKey);
        }
      });
    return () => scope.invalidate();
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
    const current = scope.capture();
    setBusy(id);
    setMessage("");
    try {
      await api(`/favorites/${id}`, { method: "DELETE" });
      if (!current()) return;
      setItems((old) => old.filter((f) => f.listingId !== id));
      setMessage("Removed from Favorites.");
    } catch (e) {
      if (current()) setMessage((e as Error).message);
    } finally {
      if (current()) setBusy(null);
    }
  }
  return (
    <section>
      <p className="eyebrow">YOUR COLLECTION</p>
      <h1>Favorites</h1>
      <p>
        <a href="/favorites/venues">Saved venues</a>
      </p>
      {loadedScope === scopeKey && message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {loadedScope === scopeKey && error && <p role="alert">{error}</p>}
      {awaitingPage ? (
        <p role="status">Loading favorites…</p>
      ) : error ? null : !items.length ? (
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
        {!awaitingPage && !error && next && (
          <a href={`/favorites?after=${encodeURIComponent(next)}`}>Next page</a>
        )}
      </nav>
      <button
        disabled={loading || busy !== null}
        onClick={() => setRevision((r) => r + 1)}
      >
        {error ? "Retry favorites" : "Refresh favorites"}
      </button>
    </section>
  );
}
