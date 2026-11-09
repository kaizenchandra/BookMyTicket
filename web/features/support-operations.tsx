import { SupportThread } from "./support-thread.tsx";
import { SupportAssignment } from "./support-assignment.tsx";
import { NotificationRecovery } from "./notification-recovery.tsx";
import { useEffect, useState, useRef } from "react";
import { api, money } from "../api.ts";
export function SupportOperations() {
  const [pages, setPages] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const after = pages.at(-1);
  const actionCommand = useRef({ input: "", key: "" });
  const replyCommand = useRef({ input: "", key: "" });
  const [filters, setFilters] = useState<Record<string, string>>({}),
    [items, setItems] = useState<any[]>([]),
    [selected, setSelected] = useState<string | null>(() =>
      new URLSearchParams(window.location.search).get("caseId"),
    ),
    [detail, setDetail] = useState<any>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState(""),
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
      setPages([]);
      setNextCursor(null);
      setSelected(null);
      setDetail(null);
      setReason("");
      setBody("");
      setFeedback("");
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
    setNextCursor(null);
    api(
      `/operations/cases?${query}${after ? `&after=${encodeURIComponent(after)}` : ""}`,
    )
      .then((r) => {
        if (active) {
          setItems(r.items);
          setNextCursor(r.nextCursor);
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
  }, [query, revision, after]);
  useEffect(() => {
    let active = true;
    setDetail(null);
    if (selected)
      api(`/operations/cases/${encodeURIComponent(selected)}`)
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
    const input = action
      ? {
          version: detail.version,
          action,
          reason,
          ...(action === "priority" ? { priority } : {}),
        }
      : { version: detail.version, audience, body };
    const command = action ? actionCommand : replyCommand;
    const fingerprint = JSON.stringify([detail.id, input]);
    if (command.current.input !== fingerprint)
      command.current = { input: fingerprint, key: crypto.randomUUID() };
    try {
      const result = await api(
        `/operations/cases/${detail.id}/${action ? "actions" : "messages"}`,
        {
          method: "POST",
          headers: { "idempotency-key": command.current.key },
          body: JSON.stringify(input),
        },
      );
      command.current = { input: "", key: "" };
      setFeedback(
        result.replayed
          ? "Original result recovered. Refreshing the current case."
          : "Change saved. Refreshing the current case.",
      );
      setReason("");
      if (!action) {
        setBody("");
        replyCommand.current = { input: "", key: "" };
      }
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
      <p role="status">{feedback}</p>
      <NotificationRecovery />
      <p>
        Cases are shown newest first, up to 100 per page. Claim a case before
        changing it or replying. Escalation returns it to the unassigned
        escalated queue.
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
              onChange={(e) => {
                setPages([]);
                setFilters({ ...filters, [key]: e.target.value });
              }}
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
      <button
        disabled={busy}
        onClick={() => {
          setPages([]);
          setRevision((r) => r + 1);
        }}
      >
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
      <nav aria-label="Case queue pages" className="chips">
        <button
          disabled={loading || !pages.length}
          onClick={() => setPages([])}
        >
          First page
        </button>
        <button
          disabled={loading || !pages.length}
          onClick={() => setPages((p) => p.slice(0, -1))}
        >
          Previous page
        </button>
        <span role="status">Page {pages.length + 1}</span>
        <button
          disabled={loading || !nextCursor}
          onClick={() => {
            if (nextCursor) setPages((p) => [...p, nextCursor]);
          }}
        >
          Next page
        </button>
      </nav>
      {detail && (
        <section aria-label="Selected case">
          <h3>{detail.subject}</h3>
          <p>
            {detail.state} · {detail.priority} · version {detail.version}
          </p>
          <p>Case reference: {detail.id}</p>
          {detail.booking && (
            <section aria-label="Linked booking">
              <h4>Linked booking</h4>
              <p>Reference: {detail.booking.id}</p>
              <p>
                Booking status: {detail.booking.state} ·{" "}
                {money(detail.booking.amountPaise)}
              </p>
              <p>
                Created{" "}
                {new Date(detail.booking.createdAt).toLocaleString("en-IN")}
              </p>
              <p>
                This is booking context only. Payment, refund and ticket states
                are separate.
              </p>
            </section>
          )}
          <SupportAssignment
            key={detail.id}
            detail={detail}
            onSaved={(message) => {
              setFeedback(message);
              setRevision((r) => r + 1);
            }}
          />
          <SupportThread
            key={`${detail.id}:${detail.version}`}
            initial={detail}
            disabled={busy}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label>
              Reply audience
              <select
                disabled={busy}
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
                disabled={busy}
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
              disabled={busy}
              minLength={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            Priority
            <select
              disabled={busy}
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
