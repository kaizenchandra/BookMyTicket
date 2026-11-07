import { useEffect, useState } from "react";
import { api } from "../api.ts";
type Session = {
  id: string;
  created_at: string | null;
  expires_at: string;
  current: boolean;
};
export function SessionManagement() {
  const [items, setItems] = useState<Session[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [confirmation, setConfirmation] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    setLoading(true);
    api<{ items: Session[] }>("/auth/sessions")
      .then((r) => {
        if (current) setItems(r.items);
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
  }, [revision]);
  async function revoke() {
    if (!confirmation || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await api(
        confirmation === "others"
          ? "/auth/sessions/revoke-others"
          : `/auth/sessions/${confirmation}`,
        {
          method: confirmation === "others" ? "POST" : "DELETE",
          ...(confirmation === "others" ? { body: "{}" } : {}),
        },
      );
      setMessage(
        "The selected sessions have been revoked. Your current session remains signed in.",
      );
      setConfirmation(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="quote-panel" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">Active sessions</h2>
      <p>
        End access from other browsers. Device names and locations are not
        collected.
      </p>
      {loading ? (
        <p role="status">Loading sessions…</p>
      ) : items.length ? (
        <ul>
          {items.map((s) => (
            <li key={s.id}>
              <strong>{s.current ? "This session" : "Other session"}</strong>
              <p>
                {s.created_at
                  ? `Signed in ${new Date(s.created_at).toLocaleString("en-IN")}`
                  : "Sign-in time was not recorded for this older session."}
                <br />
                Expires {new Date(s.expires_at).toLocaleString("en-IN")}
              </p>
              {!s.current && (
                <button disabled={busy} onClick={() => setConfirmation(s.id)}>
                  Revoke session {s.id.slice(0, 8)}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No active sessions are available. Sign in again if your session has
          expired.
        </p>
      )}
      <button
        disabled={busy || loading || !items.some((s) => !s.current)}
        onClick={() => setConfirmation("others")}
      >
        Sign out all other sessions
      </button>
      {confirmation && (
        <div className="notice">
          <p>
            Revoke{" "}
            {confirmation === "others"
              ? "all other sessions"
              : `session ${confirmation.slice(0, 8)}`}
            ? Those sessions will need to sign in again.
          </p>
          <button disabled={busy} onClick={revoke}>
            {busy ? "Revoking…" : "Confirm revocation"}
          </button>
          <button disabled={busy} onClick={() => setConfirmation(null)}>
            Cancel
          </button>
        </div>
      )}
      {message && <p role="status">{message}</p>}
      <button
        disabled={busy || loading}
        onClick={() => setRevision((r) => r + 1)}
      >
        Refresh sessions
      </button>
    </section>
  );
}
