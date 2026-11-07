import { useState } from "react";
import { api } from "../api.ts";
export function NotificationRecovery() {
  const [items, setItems] = useState<any[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      setItems((await api("/operations/notification-deliveries")).items);
      setLoaded(true);
    } catch (e) {
      setItems([]);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function replay(id: string) {
    const reason = window.prompt(
      "Record why this failed inbox delivery should be retried:",
    );
    if (!reason) return;
    setBusy(true);
    try {
      await api(`/operations/notification-deliveries/${id}/replay`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>Failed in-app notification deliveries</summary>
      <p>
        Latest 100 exhausted deliveries. Resolve the underlying issue before
        replaying. This does not retry payment or change booking status.
      </p>
      <button disabled={busy} onClick={() => void refresh()}>
        Load failed deliveries
      </button>
      {error && <p role="alert">{error}</p>}
      {loaded && !items.length && <p>No exhausted deliveries.</p>}
      {items.map((i) => (
        <article key={i.event_id}>
          <p>
            {i.event_id} · {i.attempts} attempts · {i.last_error_code}
          </p>
          <button disabled={busy} onClick={() => void replay(i.event_id)}>
            Request replay
          </button>
        </article>
      ))}
    </details>
  );
}
