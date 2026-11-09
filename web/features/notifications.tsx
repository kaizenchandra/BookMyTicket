import { useEffect, useRef, useState } from "react";
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
    [busy, setBusy] = useState<string | null>(null),
    [unreadCount, setUnreadCount] = useState<number | null>(null),
    [message, setMessage] = useState("");
  const actor = useRef(accountId);
  actor.current = accountId;
  useEffect(() => {
    let active = true;
    setItems([]);
    setNext(null);
    setUnreadCount(null);
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
          setUnreadCount(r.unreadCount);
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
  async function mark(id: string, read: boolean) {
    const expected = accountId;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      await api(`/notifications/${id}/read`, {
        method: read ? "POST" : "DELETE",
        ...(read ? { body: "{}" } : {}),
      });
      if (actor.current === expected) {
        setMessage(
          read ? "Notification marked read." : "Notification marked unread.",
        );
        setRevision((r) => r + 1);
      }
    } catch (e) {
      if (actor.current === expected) setError((e as Error).message);
    } finally {
      if (actor.current === expected) setBusy(null);
    }
  }
  async function markDisplayed() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id),
      expected = accountId;
    if (!ids.length) return;
    setBusy("page");
    setError("");
    setMessage("");
    try {
      await api("/notifications/read", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      if (actor.current === expected) {
        setMessage("Displayed unread notifications marked read.");
        setRevision((r) => r + 1);
      }
    } catch (e) {
      if (actor.current === expected) setError((e as Error).message);
    } finally {
      if (actor.current === expected) setBusy(null);
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
      {unreadCount !== null && (
        <p role="status">{unreadCount} unread notifications in your inbox.</p>
      )}
      {message && <p role="status">{message}</p>}
      <p>
        Updates describe events when they occurred. Open the linked record for
        its current status.
      </p>
      <label>
        <input
          type="checkbox"
          checked={unread}
          disabled={loading || busy !== null}
          onChange={(e) => {
            setUnread(e.target.checked);
            setCursor(null);
          }}
        />{" "}
        Unread only
      </label>
      <button
        disabled={loading || busy !== null}
        onClick={() => {
          setCursor(null);
          setRevision((r) => r + 1);
        }}
      >
        Refresh
      </button>
      <button
        disabled={
          loading || busy !== null || !!error || !items.some((n) => !n.read_at)
        }
        onClick={() => void markDisplayed()}
      >
        {busy === "page"
          ? "Saving…"
          : "Mark displayed unread notifications as read"}
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading notifications…</p>
      ) : error && items.length === 0 ? null : items.length === 0 ? (
        <p>No {unread ? "unread " : ""}notifications on this page.</p>
      ) : (
        items.map((n) => (
          <article className="organization" key={n.id}>
            <p>{n.read_at ? "Read" : "Unread"}</p>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <time>{new Date(n.occurred_at).toLocaleString("en-IN")}</time>
            <p>
              <a href={n.href}>
                {n.href.startsWith("/cases?")
                  ? "View support case"
                  : n.href.startsWith("/operations?")
                    ? "View assigned case"
                    : "View booking"}
              </a>
            </p>
            <button
              disabled={busy !== null || loading}
              onClick={() => void mark(n.id, Boolean(!n.read_at))}
            >
              {busy === n.id
                ? "Saving…"
                : n.read_at
                  ? "Mark as unread"
                  : "Mark as read"}
            </button>
          </article>
        ))
      )}
      <div className="chips">
        {cursor && (
          <button
            disabled={loading || busy !== null}
            onClick={() => setCursor(null)}
          >
            Newest updates
          </button>
        )}
        {next && !loading && !error && (
          <button disabled={busy !== null} onClick={() => setCursor(next)}>
            Older updates
          </button>
        )}
      </div>
    </section>
  );
}
