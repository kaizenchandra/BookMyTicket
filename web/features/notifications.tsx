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
    [status, setStatus] = useState("all"),
    [category, setCategory] = useState(""),
    [fromDate, setFromDate] = useState(""),
    [toDate, setToDate] = useState(""),
    [dates, setDates] = useState({ fromDate: "", toDate: "" }),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [unreadCount, setUnreadCount] = useState<number | null>(null),
    [message, setMessage] = useState("");
  const actor = useRef(accountId);
  actor.current = accountId;
  useEffect(() => {
    setCategory("");
    setFromDate("");
    setToDate("");
    setDates({ fromDate: "", toDate: "" });
    setStatus("all");
    setCursor(null);
    setBusy(null);
    setMessage("");
  }, [accountId]);
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
      status,
      ...(dates.fromDate ? { fromDate: dates.fromDate } : {}),
      ...(dates.toDate ? { toDate: dates.toDate } : {}),
      ...(category ? { category } : {}),
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
  }, [accountId, cursor, status, category, dates, revision]);
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
  async function markDisplayed(read: boolean) {
    const ids = items
        .filter((n) => (read ? !n.read_at : !!n.read_at))
        .map((n) => n.id),
      expected = accountId;
    if (!ids.length) return;
    setBusy(read ? "page-read" : "page-unread");
    setError("");
    setMessage("");
    try {
      await api(read ? "/notifications/read" : "/notifications/unread", {
        method: "POST",
        body: JSON.stringify({ ids }),
      });
      if (actor.current === expected) {
        setMessage(
          read
            ? "Displayed unread notifications marked read."
            : "Displayed read notifications marked unread.",
        );
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (fromDate && toDate && fromDate > toDate) {
            setError("From date must not follow to date.");
            return;
          }
          setDates({ fromDate, toDate });
          setCursor(null);
        }}
      >
        <p>
          Event dates use India time (Asia/Kolkata), including both selected
          days. Delivery may occur later.
        </p>
        <label>
          From date
          <input
            type="date"
            value={fromDate}
            disabled={loading || busy !== null}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={toDate}
            disabled={loading || busy !== null}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>
        <button disabled={loading || busy !== null}>Apply dates</button>
        <button
          type="button"
          disabled={loading || busy !== null}
          onClick={() => {
            setFromDate("");
            setToDate("");
            setDates({ fromDate: "", toDate: "" });
            setCursor(null);
          }}
        >
          Clear dates
        </button>
      </form>
      {(dates.fromDate || dates.toDate) && (
        <p>
          Applied event dates (India time): {dates.fromDate || "Any start"} to{" "}
          {dates.toDate || "Any end"}.
        </p>
      )}
      <label>
        Notification category
        <select
          value={category}
          disabled={loading || busy !== null}
          onChange={(e) => {
            setCategory(e.target.value);
            setCursor(null);
          }}
        >
          <option value="">All updates</option>
          <option value="booking">Bookings</option>
          <option value="payment">Payments</option>
          <option value="support">Support</option>
        </select>
      </label>
      <label>
        Read status
        <select
          value={status}
          disabled={loading || busy !== null}
          onChange={(e) => {
            setStatus(e.target.value);
            setCursor(null);
          }}
        >
          <option value="all">All notifications</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
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
        onClick={() => void markDisplayed(true)}
      >
        {busy === "page-read"
          ? "Saving…"
          : "Mark displayed unread notifications as read"}
      </button>
      <button
        disabled={
          loading || busy !== null || !!error || !items.some((n) => !!n.read_at)
        }
        onClick={() => void markDisplayed(false)}
      >
        {busy === "page-unread"
          ? "Saving…"
          : "Mark displayed read notifications as unread"}
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Loading notifications…</p>
      ) : error && items.length === 0 ? null : items.length === 0 ? (
        <p>
          No {status === "all" ? "" : `${status} `}notifications match these
          filters on this page.
        </p>
      ) : (
        items.map((n) => (
          <article className="organization" key={n.id}>
            <p>{n.read_at ? "Read" : "Unread"}</p>
            <h2>{n.title}</h2>
            <p>{n.body}</p>
            <time dateTime={n.occurred_at}>
              {new Date(n.occurred_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}
            </time>
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
