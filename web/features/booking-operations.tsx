import React, { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import { useAdminCapabilities } from "./admin-workspace.tsx";
type ExceptionRecord = {
  state: string;
  assigned_to: string | null;
  version: number;
};
type CaseView = {
  exception: ExceptionRecord | null;
  history: {
    items: {
      id: string;
      action: string;
      reason: string;
      actor_id: string;
      created_at: string;
      before_data: ExceptionRecord | null;
      after_data: ExceptionRecord;
    }[];
    nextBefore: string | null;
  };
};
export function BookingOperations({
  id,
  state,
}: {
  id: string;
  state: string;
}) {
  const permissions = useAdminCapabilities(),
    manage = permissions.includes("bookings.manage"),
    [data, setData] = useState<CaseView | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [before, setBefore] = useState(""),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState("open"),
    [assignedTo, setAssignedTo] = useState(""),
    [reason, setReason] = useState(""),
    key = useRef({ body: "", key: "" });
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api<CaseView>(
      `/admin/bookings/${id}/exceptions${before ? "?before=" + before : ""}`,
      { signal: c.signal },
    )
      .then((d) => {
        if (!c.signal.aborted) {
          setData(d);
          setAction(
            !d.exception
              ? "open"
              : d.exception.state === "resolved"
                ? "reopen"
                : "assign",
          );
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [id, revision, before]);
  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = JSON.stringify({
      action,
      expectedVersion: data?.exception?.version ?? 0,
      reason,
      ...(action === "assign" ? { assignedTo: assignedTo.trim() || null } : {}),
    });
    if (key.current.body !== body)
      key.current = { body, key: crypto.randomUUID() };
    try {
      await api(`/admin/bookings/${id}/exceptions`, {
        method: "POST",
        headers: { "idempotency-key": key.current.key },
        body,
      });
      setReason("");
      setBefore("");
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dashboard-panel">
      {manage && state === "confirmed" && (
        <p>
          <a href={`/api/v1/admin/bookings/${id}/tickets/download`}>
            Download admission ticket document
          </a>{" "}
          · Contains active admission credentials; access is audited.
        </p>
      )}
      <h2>Booking exception</h2>
      <p>
        Exception resolution does not change the booking, payment or ticket
        state.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading exception…</p>}
      {data && (
        <>
          <p>
            {data.exception
              ? `${data.exception.state} · Version ${data.exception.version} · Assigned to ${data.exception.assigned_to ?? "nobody"}`
              : "No recorded exception."}
          </p>
          {manage && (
            <form onSubmit={apply}>
              <fieldset disabled={busy}>
                <label>
                  Action
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  >
                    {(!data.exception
                      ? ["open"]
                      : data.exception.state === "resolved"
                        ? ["reopen"]
                        : ["assign", "escalate", "resolve"]
                    ).map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </label>
                {action === "assign" && (
                  <label>
                    Administrator account ID (blank to unassign)
                    <input
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                    />
                    <small>
                      Must be active with bookings.read and bookings.manage.
                    </small>
                  </label>
                )}
                <label>
                  Reason
                  <textarea
                    required
                    minLength={10}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label>
                  <input type="checkbox" required />
                  Confirm this exception change
                </label>
                <button>{busy ? "Applying…" : "Apply"}</button>
              </fieldset>
            </form>
          )}
          <h3>Exception history</h3>
          {data.history.items.map((h) => (
            <article key={h.id}>
              <p>
                {h.action} · {new Date(h.created_at).toLocaleString("en-IN")} ·
                Actor {h.actor_id}
              </p>
              <p>{h.reason}</p>
              <details>
                <summary>Before / after</summary>
                <pre>
                  {JSON.stringify(
                    { before: h.before_data, after: h.after_data },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          ))}
          {before && (
            <button onClick={() => setBefore("")}>Latest history</button>
          )}
          {data.history.nextBefore && (
            <button onClick={() => setBefore(data.history.nextBefore!)}>
              Earlier history
            </button>
          )}
        </>
      )}
      {manage && state === "pending_payment" && <AdminCancel id={id} />}
      <p>
        Confirmed-booking cancellation, rescheduling and passenger corrections
        require additional product policies and are not available in this panel.
      </p>
    </section>
  );
}
function AdminCancel({ id }: { id: string }) {
  const [preview, setPreview] = useState<{
      allowed: boolean;
      previewId: string | null;
      consequence: string;
      expiresAt: string | null;
      paymentActivity: boolean;
    } | null>(null),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    key = useRef({ body: "", key: "" });
  async function review() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      setPreview(
        await api(`/admin/bookings/${id}/pending-cancellation/preview`, {
          method: "POST",
          body: "{}",
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = JSON.stringify({
      previewId: preview?.previewId,
      reason,
      acknowledgePaymentRisk: true,
    });
    if (key.current.body !== body)
      key.current = { body, key: crypto.randomUUID() };
    try {
      await api(`/admin/bookings/${id}/pending-cancellation`, {
        method: "POST",
        headers: { "idempotency-key": key.current.key },
        body,
      });
      location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>Cancel pending booking</h3>
      <button disabled={busy} onClick={review}>
        Review cancellation
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <>
          <p>{preview.consequence}</p>
          <p>
            Payment activity:{" "}
            {preview.paymentActivity ? "Observed" : "None observed"}. Preview
            expires: {preview.expiresAt ?? "Unavailable"}.
          </p>
          {preview.allowed && (
            <form onSubmit={cancel}>
              <fieldset disabled={busy}>
                <label>
                  Cancellation reason
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <label>
                  <input required type="checkbox" />
                  Cancel this pending booking. I acknowledge payment may still
                  complete and require refund recovery.
                </label>
                <button>Confirm cancellation</button>
              </fieldset>
            </form>
          )}
          {!preview.allowed && (
            <p>Booking is no longer eligible. Reload its current status.</p>
          )}
        </>
      )}
    </section>
  );
}
