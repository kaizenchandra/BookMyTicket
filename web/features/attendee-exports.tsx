import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type { AssignedForm } from "../../src/modules/events/contracts/index.ts";
type Job = {
  id: string;
  form_id: string;
  fields: string[];
  purpose: string;
  state: string;
  row_count: number | null;
  generated_at: string | null;
  expires_at: string;
  error_code: string | null;
  server_time: string;
};
export function AttendeeExportPanel({
  occurrenceId,
}: {
  occurrenceId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Secure attendee exports</summary>
      {open && (
        <ExportWorkspace key={occurrenceId} occurrenceId={occurrenceId} />
      )}
    </details>
  );
}
function ExportWorkspace({ occurrenceId }: { occurrenceId: string }) {
  const [forms, setForms] = useState<AssignedForm[]>([]),
    [formId, setFormId] = useState(""),
    [fields, setFields] = useState<string[]>([]),
    [purpose, setPurpose] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [jobs, setJobs] = useState<Job[]>([]),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const operation = useRef({ body: "", key: crypto.randomUUID() }),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      api<{ history: AssignedForm[] }>(
        `/occurrences/${occurrenceId}/registration-form`,
      ),
      api<{ items: Job[] }>(`/occurrences/${occurrenceId}/attendee-exports`),
    ])
      .then(([f, j]) => {
        if (!current) return;
        setForms(f.history);
        setJobs(j.items);
        setMessage("");
      })
      .catch((e) => {
        if (current) {
          setJobs([]);
          setMessage(e.message);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [occurrenceId, revision]);
  const pending = jobs.some((j) => j.state === "queued");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setRevision((r) => r + 1), 10000);
    return () => clearInterval(timer);
  }, [pending]);
  const selected = forms.find((f) => f.id === formId);
  async function request() {
    setBusy(true);
    setMessage("");
    const body = JSON.stringify({
      occurrenceId,
      formId,
      fields,
      purpose,
      confirmScope: confirmed,
    });
    if (operation.current.body !== body)
      operation.current = { body, key: crypto.randomUUID() };
    try {
      await api("/attendee-exports", {
        method: "POST",
        headers: { "Idempotency-Key": operation.current.key },
        body,
      });
      if (mounted.current) {
        operation.current = { body: "", key: crypto.randomUUID() };
        setConfirmed(false);
        setRevision((r) => r + 1);
      }
    } catch (e) {
      if (mounted.current) setMessage((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function download(id: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/attendee-exports/${id}/download`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message ?? "Download unavailable.");
      }
      const blob = await response.blob();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `attendees-${id}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      if (mounted.current) setMessage((e as Error).message);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section>
      <p>
        Organization owners can export confirmed registrations. Choose one form
        version and only the fields needed. Downloads expire 24 hours after
        request. Never share attendee files publicly.
      </p>
      <p>
        <a href="/profile">Verify your authenticator in your profile</a> before
        requesting or downloading personal data.
      </p>
      {loading && <p role="status">Refreshing export status…</p>}
      {message && (
        <p role="alert" className="notice">
          {message}
        </p>
      )}
      <fieldset disabled={busy || loading}>
        <legend>Export scope</legend>
        <label>
          Form version
          <select
            value={formId}
            onChange={(e) => {
              setFormId(e.target.value);
              setFields([]);
              setConfirmed(false);
            }}
          >
            <option value="">Select a version</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                Version {f.version} · {f.definition.title}
              </option>
            ))}
          </select>
        </label>
        {selected?.definition.fields.map((f) => (
          <label key={f.id}>
            <input
              type="checkbox"
              checked={fields.includes(f.id)}
              onChange={(e) => {
                setFields((old) =>
                  e.target.checked
                    ? [...old, f.id]
                    : old.filter((x) => x !== f.id),
                );
                setConfirmed(false);
              }}
            />
            {f.label} — {f.purpose}
          </label>
        ))}
        <label>
          Purpose (do not enter attendee details)
          <textarea
            value={purpose}
            maxLength={500}
            onChange={(e) => {
              setPurpose(e.target.value);
              setConfirmed(false);
            }}
          />
        </label>
        <p>
          Scope: this occurrence, form version{" "}
          {selected?.version ?? "not selected"}, {fields.length} selected
          fields, confirmed orders only. Order references and attendee numbers
          are included.
        </p>
        <label>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I confirm that this scope and these fields are needed for the stated
          purpose.
        </label>
        <button
          className="primary"
          disabled={!confirmed || !fields.length || purpose.trim().length < 10}
          onClick={request}
        >
          Request encrypted export
        </button>
      </fieldset>
      <h4>Your recent exports</h4>
      {!jobs.length && !loading && (
        <p>No exports available for this occurrence.</p>
      )}
      <ul>
        {jobs.map((j) => (
          <li key={j.id}>
            <p>
              {j.id.slice(0, 8)} · {j.state} ·{" "}
              {j.row_count === null
                ? "Row count pending"
                : `${j.row_count} attendees`}
            </p>
            <p>
              Fields: {j.fields.join(", ")}. Expires{" "}
              {new Date(j.expires_at).toLocaleString("en-IN")}.{" "}
              {j.generated_at &&
                `Snapshot generated ${new Date(j.generated_at).toLocaleString("en-IN")}.`}
            </p>
            {j.error_code && (
              <p role="status">
                {j.error_code}
                {j.state === "queued"
                  ? " · retry scheduled"
                  : " · review the issue and make a new request"}
              </p>
            )}
            {j.state === "ready" && (
              <button disabled={busy} onClick={() => download(j.id)}>
                Download CSV
              </button>
            )}
          </li>
        ))}
      </ul>
      <button
        disabled={loading || busy}
        onClick={() => setRevision((r) => r + 1)}
      >
        Refresh export status
      </button>
    </section>
  );
}
