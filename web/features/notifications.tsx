import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function NotificationInbox({
  accountId,
  signIn,
}: {
  accountId?: string;
  signIn: () => void;
}) {
  const [items, setItems] = useState<any[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [next, setNext] = useState<string | null>(null),
    [unread, setUnread] = useState(false),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setItems([]);
    setError("");
    setLoading(true);
    if (!accountId) {
      setLoading(false);
      return;
    }
    const q = new URLSearchParams({
      unread: String(unread),
      ...(cursor ? { after: cursor } : {}),
    });
    api(`/notifications?${q}`)
      .then((r) => {
        if (active) {
          setItems(r.items);
          setNext(r.nextCursor);
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
  }, [accountId, cursor, unread, revision]);
  async function mark(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/notifications/${id}/read`, { method: "POST", body: "{}" });
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  if (!accountId)
    return (
      <section className="reading">
        <h1>Notifications</h1>
        <p>Sign in to view your updates.</p>
        <button onClick={signIn}>Sign in</button>
      </section>
    );
  return (
    <section className="reading">
      <h1>Notifications</h1>
      <p>
        Updates describe events when they occurred. Open your booking for its
        current status.
      </p>
      <label>
        <input
          type="checkbox"
          checked={unread}
          onChange={(e) => {
            setUnread(e.target.checked);
            setCursor(null);
          }}
        />{" "}
        Unread only
      </label>
      <button
        onClick={() => {
          setCursor(null);
          setRevision((r) => r + 1);
        }}
      >
        Refresh
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading notifications…</p>
      ) : items.length === 0 ? (
        <p>No {unread ? "unread " : ""}notifications on this page.</p>
      ) : (
        items.map((n) => (
          <article className="organization" key={n.id}>
            <p>{n.read_at ? "Read" : "Unread"}</p>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <time>{new Date(n.occurred_at).toLocaleString("en-IN")}</time>
            <p>
              <a href={n.href}>View booking</a>
            </p>
            {!n.read_at && (
              <button disabled={busy !== null} onClick={() => void mark(n.id)}>
                {busy === n.id ? "Saving…" : "Mark as read"}
              </button>
            )}
          </article>
        ))
      )}
      <div className="chips">
        {cursor && (
          <button disabled={loading} onClick={() => setCursor(null)}>
            Newest updates
          </button>
        )}
        {next && !loading && (
          <button onClick={() => setCursor(next)}>Older updates</button>
        )}
      </div>
    </section>
  );
}
