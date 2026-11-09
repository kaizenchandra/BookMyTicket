import { useEffect, useState } from "react";
import { api } from "../api.ts";
type AuditPage = {
  items: {
    id: string;
    actor_id: string | null;
    action: string;
    target: string;
    created_at: string;
    outcome: string;
  }[];
  nextCursor: string | null;
  serverTime: string;
};
export function AuditHistory() {
  const [query, setQuery] = useState(""),
    [cursor, setCursor] = useState(""),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState<AuditPage | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const clear = () => {
      setPage(null);
      setCursor("");
      setRevision((v) => v + 1);
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setPage(null);
    setError("");
    const params = new URLSearchParams(query);
    if (cursor) params.set("after", cursor);
    api<AuditPage>(`/admin/audit?${params}`)
      .then((result) => {
        if (active) setPage(result);
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
  }, [query, cursor, revision]);
  return (
    <section className="reading">
      <p className="eyebrow">PLATFORM ADMINISTRATION</p>
      <h1>Audit history</h1>
      <p>
        <a href="/admin">Back to administration</a> ·{" "}
        <a href="/profile">Account security and MFA</a>
      </p>
      <p>
        Requires the platform audit permission and recent MFA verification.
        Filters use exact identifiers; timestamps are displayed in UTC. Raw
        event details are excluded from this view.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget),
            params = new URLSearchParams();
          for (const field of ["actor", "action", "target", "from", "until"]) {
            const value = String(data.get(field) ?? "").trim();
            if (value) params.set(field, value);
          }
          setQuery(params.toString());
          setCursor("");
          setRevision((v) => v + 1);
        }}
      >
        <label>
          Actor account UUID
          <input name="actor" placeholder="Exact account UUID" />
        </label>
        <label>
          Action
          <input
            name="action"
            maxLength={200}
            placeholder="e.g. event.online_access_configured"
          />
        </label>
        <label>
          Target identifier
          <input
            name="target"
            maxLength={200}
            placeholder="Exact booking, occurrence or other target ID"
          />
        </label>
        <label>
          From, inclusive (ISO timestamp with offset)
          <input name="from" placeholder="2026-11-01T00:00:00+05:30" />
        </label>
        <label>
          Until, exclusive (ISO timestamp with offset)
          <input name="until" placeholder="2026-12-01T00:00:00+05:30" />
        </label>
        <button className="primary">Search audit history</button>
        <button
          type="reset"
          onClick={() => {
            setQuery("");
            setCursor("");
            setRevision((v) => v + 1);
          }}
        >
          Clear filters
        </button>
      </form>
      <div role="status" aria-live="polite">
        {loading
          ? "Loading authorized audit records…"
          : error || (page ? `${page.items.length} records on this page.` : "")}
      </div>
      {error && (
        <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
      )}
      {page && (
        <>
          <p className="muted">
            Retrieved {new Date(page.serverTime).toISOString()}. Newly added
            records appear after refreshing the first page.
          </p>
          {!page.items.length && <p>No audit records match these filters.</p>}
          <ol className="audit-records">
            {page.items.map((item) => (
              <li key={item.id} className="organization">
                <h2>{item.action}</h2>
                <dl>
                  <dt>Record</dt>
                  <dd>{item.id}</dd>
                  <dt>Actor</dt>
                  <dd>
                    {item.actor_id ?? "Not recorded (system or legacy record)"}
                  </dd>
                  <dt>Target</dt>
                  <dd>{item.target}</dd>
                  <dt>Time (UTC)</dt>
                  <dd>
                    <time dateTime={item.created_at}>
                      {new Date(item.created_at).toISOString()}
                    </time>
                  </dd>
                  <dt>Outcome</dt>
                  <dd>
                    {item.outcome === "not_recorded"
                      ? "Not recorded"
                      : item.outcome}
                  </dd>
                </dl>
              </li>
            ))}
          </ol>
          <button
            onClick={() => {
              setCursor("");
              setRevision((v) => v + 1);
            }}
          >
            Refresh first page
          </button>
          <button
            disabled={!page.nextCursor}
            onClick={() => setCursor(page.nextCursor!)}
          >
            Older records
          </button>
        </>
      )}
      <p className="muted">
        Historical records may omit actors and outcomes. This view does not
        infer success from the presence of an audit record.
      </p>
    </section>
  );
}
