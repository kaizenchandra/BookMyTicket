import { NotificationRecovery } from "./notification-recovery.tsx";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
export function SupportOperations() {
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [detail, setDetail] = useState<any>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [reason, setReason] = useState(""),
    [body, setBody] = useState(""),
    [audience, setAudience] = useState("internal"),
    [priority, setPriority] = useState("normal");
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  ).toString();
  useEffect(() => {
    const clear = () => {
      setItems([]);
      setSelected(null);
      setDetail(null);
      setReason("");
      setBody("");
      setRevision((r) => r + 1);
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setItems([]);
    api(`/operations/cases?${query}`)
      .then((r) => {
        if (active) setItems(r.items);
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
  }, [query, revision]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    if (selected)
      api(`/operations/cases/${selected}`)
        .then((r) => {
          if (active) {
            setDetail(r);
            setPriority(r.priority);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selected, revision]);
  async function send(action?: string) {
    if (!detail || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(
        `/operations/cases/${detail.id}/${action ? "actions" : "messages"}`,
        {
          method: "POST",
          body: JSON.stringify(
            action
              ? {
                  version: detail.version,
                  action,
                  reason,
                  ...(action === "priority" ? { priority } : {}),
                }
              : { version: detail.version, audience, body },
          ),
        },
      );
      setReason("");
      if (!action) setBody("");
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Support cases</h2>
      <NotificationRecovery />
      <p>
        Latest 100 matching cases. Claim a case before changing it or replying.
        Escalation returns it to the unassigned escalated queue.
      </p>
      <div className="chips">
        {Object.entries({
          state: ["open", "in_progress", "escalated", "resolved"],
          priority: ["low", "normal", "high", "urgent"],
          category: ["booking", "payment", "accessibility", "other"],
          assignment: ["mine", "unassigned"],
        }).map(([key, values]) => (
          <label key={key}>
            {key}
            <select
              value={filters[key] ?? ""}
              onChange={(e) =>
                setFilters({ ...filters, [key]: e.target.value })
              }
            >
              <option value="">All</option>
              {values.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy} onClick={() => setRevision((r) => r + 1)}>
        Refresh cases and selected conversation
      </button>
      {loading ? (
        <p role="status">Loading cases…</p>
      ) : !items.length ? (
        <p>No matching cases.</p>
      ) : (
        items.map((c) => (
          <article className="organization" key={c.id}>
            <button
              onClick={() => {
                if (
                  (body || reason) &&
                  !window.confirm("Discard unsent case edits?")
                )
                  return;
                setSelected(c.id);
                setBody("");
                setReason("");
              }}
            >
              {c.subject}
            </button>
            <p>
              {c.category} · {c.priority} · {c.state} ·{" "}
              {c.assigned_to ? "Assigned" : "Unassigned"}
            </p>
          </article>
        ))
      )}
      {detail && (
        <section aria-label="Selected case">
          <h3>{detail.subject}</h3>
          <p>
            {detail.state} · {detail.priority} · version {detail.version}
          </p>
          <p>Case reference: {detail.id}</p>
          {detail.messages.map((m: any) => (
            <article className="organization" key={m.id}>
              <strong>
                {m.audience === "internal"
                  ? "Internal note — staff only"
                  : "Customer-visible message"}
              </strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
              <time>{new Date(m.created_at).toLocaleString("en-IN")}</time>
            </article>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label>
              Reply audience
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="internal">Internal note — staff only</option>
                <option value="customer">Customer-visible reply</option>
              </select>
            </label>
            <label>
              Message
              <textarea
                required
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <p>
              {audience === "internal"
                ? "This note is visible only to authorized staff."
                : "The customer will see this reply in their support case."}
            </p>
            <button disabled={busy || !body.trim()}>
              Send{" "}
              {audience === "internal" ? "internal note" : "customer reply"}
            </button>
          </form>
          <label>
            Action reason
            <input
              minLength={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {["low", "normal", "high", "urgent"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="chips">
            {(detail.state === "resolved"
              ? ["reopen"]
              : ["claim", "release", "escalate", "resolve", "priority"]
            ).map((action) => (
              <button
                key={action}
                disabled={busy || reason.trim().length < 5}
                onClick={() => void send(action)}
              >
                {action === "priority" ? "Set priority" : action}
              </button>
            ))}
          </div>
          <p>
            Actions are verified by the server. A stale version requires
            refreshing before retrying.
          </p>
        </section>
      )}
    </section>
  );
}
