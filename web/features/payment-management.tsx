import React, { useEffect, useState } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { dashboardMoney } from "./admin-money.ts";
function errorText(e: unknown) {
  return e instanceof ApiError
    ? e.message +
        " " +
        (e.fields ?? [])
          .map((f) => f.path.join(".") + ": " + f.message)
          .join("; ")
    : (e as Error).message;
}
export function PaymentReportExport() {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult("");
    try {
      const filters = Object.fromEntries(
          [...new URLSearchParams(location.search)].filter(
            ([k, v]) => k !== "after" && v !== "",
          ),
        ),
        r = await api<{ csv: string; filename: string; rows: number }>(
          "/admin/payments/reports",
          {
            method: "POST",
            body: JSON.stringify({ filters, reason, confirm: true }),
          },
        ),
        url = URL.createObjectURL(
          new Blob([r.csv], { type: "text/csv;charset=utf-8" }),
        ),
        a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResult(`Approved and exported ${r.rows} rows.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="dashboard-panel">
      <summary>Approve and export transaction report</summary>
      <p>
        Exports all matching rows, up to 5000, using the applied filters. Set
        both observed-date filters (at most 366 days). Amounts are integer
        paise; observations do not prove bank settlement. This approval is
        recorded against your finance account.
      </p>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            Finance approval reason
            <textarea
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <label>
            <input type="checkbox" required />I approve exporting these
            transaction records.
          </label>
          <button>{busy ? "Exporting…" : "Approve and download CSV"}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && <p role="status">{result}</p>}
    </details>
  );
}
type Detail = {
  attempt: {
    id: string;
    transaction_id: string;
    booking_id: string;
    provider: string;
    method: string | null;
    state: string;
    amount_paise: string;
    amount_refunded_paise: string | null;
    observed_at: string;
    error_code: string | null;
    error_reason: string | null;
  };
  capture: { amount_paise: string; captured_at: string } | null;
  recovery: {
    id: string;
    state: string;
    reason: string;
    amount_paise: string;
  } | null;
  reconciliation: {
    state: string;
    provider_id: string | null;
    checked_at: string | null;
    failures: number;
    last_error_code: string | null;
    review_required: boolean;
    in_progress: boolean | null;
  };
  history: {
    items: {
      id: string;
      previous_state: string | null;
      state: string;
      recorded_at: string;
      error_code: string | null;
      error_reason: string | null;
      method: string | null;
      amount_refunded_paise: string | null;
    }[];
    nextCursor: string | null;
  };
  refundEligibility: { reason: string };
  settlement: { state: string };
  capturePolicy: { mode: string; partialCaptureSupported: boolean };
};
export function PaymentManagementDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [after, setAfter] = useState(""),
    grants = useAdminCapabilities();
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api<Detail>(
      `/admin/payments/${id}${after ? "?after=" + encodeURIComponent(after) : ""}`,
      { signal: c.signal },
    )
      .then((r) => {
        if (!c.signal.aborted) setData(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorText(e));
      });
    return () => c.abort();
  }, [id, after]);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Payment transaction</h1>
      <a href="/admin/payments">All payments</a>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading transaction…</p>}
      {data && (
        <>
          <section className="dashboard-panel">
            <h2>{data.attempt.transaction_id}</h2>
            <p>
              Provider: {data.attempt.provider} · Method:{" "}
              {data.attempt.method ?? "Unknown / not recorded"}
            </p>
            <p>
              Booking:{" "}
              {grants.includes("bookings.read") ? (
                <a href={`/admin/bookings/${data.attempt.booking_id}`}>
                  {data.attempt.booking_id}
                </a>
              ) : (
                data.attempt.booking_id
              )}
            </p>
            <p>
              Observed state: {data.attempt.state} ·{" "}
              {new Date(data.attempt.observed_at).toLocaleString("en-IN")}
            </p>
            <p>Original amount: {dashboardMoney(data.attempt.amount_paise)}</p>
            <p>
              Provider-observed cumulative refunded amount:{" "}
              {data.attempt.amount_refunded_paise === null
                ? "Unknown"
                : dashboardMoney(data.attempt.amount_refunded_paise)}
              . Not a platform refund ledger.
            </p>
            <p>
              Failure code: {data.attempt.error_code ?? "Not supplied"} ·
              Reason: {data.attempt.error_reason ?? "Not supplied"}. Codes may
              describe an earlier failed observation; use the timeline for
              context.
            </p>
          </section>
          <section className="dashboard-panel">
            <h2>Capture, refund and settlement</h2>
            <p>
              Local capture:{" "}
              {data.capture
                ? `${dashboardMoney(data.capture.amount_paise)} at ${data.capture.captured_at}`
                : "No recorded capture"}
            </p>
            <p>
              Capture policy: merchant auto-capture. Partial/manual capture is
              not supported by this application.
            </p>
            <p>
              Settlement: not connected. Capture does not prove payout or bank
              settlement.
            </p>
            <p>
              Refund eligibility: requires review.{" "}
              {data.refundEligibility.reason}
            </p>
            {data.recovery && (
              <p>
                Recovery obligation: {data.recovery.state} ·{" "}
                {dashboardMoney(data.recovery.amount_paise)} ·{" "}
                {data.recovery.reason}.{" "}
                <a href={`/admin/refunds?booking=${data.attempt.booking_id}`}>
                  View recovery records
                </a>
              </p>
            )}
          </section>
          <section className="dashboard-panel">
            <h2>Provider reconciliation</h2>
            <p>
              Order: {data.reconciliation.provider_id ?? "Unresolved"} ·
              Mapping: {data.reconciliation.state}
            </p>
            <p>
              Last checked: {data.reconciliation.checked_at ?? "Never"} ·
              Failures: {data.reconciliation.failures} · Error:{" "}
              {data.reconciliation.last_error_code ?? "None recorded"}
            </p>
            <p>
              {data.reconciliation.review_required
                ? "Manual investigation required"
                : data.reconciliation.in_progress
                  ? "Worker currently checking"
                  : "Scheduled reconciliation"}
              . This checks provider payment status, not bank settlement.
            </p>
          </section>
          <section className="dashboard-panel">
            <h2>Immutable observation history</h2>
            <p>
              Historical method/refund metadata may be unknown; it is not
              backfilled.
            </p>
            {data.history.items.map((h) => (
              <article key={h.id}>
                <p>
                  {h.previous_state ?? "First observation"} → {h.state} ·{" "}
                  {new Date(h.recorded_at).toLocaleString("en-IN")}
                </p>
                <p>
                  {h.method ?? "Method unknown"} ·{" "}
                  {h.error_code ?? "No error code"} · {h.error_reason ?? ""} ·
                  Refunded:{" "}
                  {h.amount_refunded_paise === null
                    ? "Unknown"
                    : dashboardMoney(h.amount_refunded_paise)}
                </p>
              </article>
            ))}
            {after && (
              <button onClick={() => setAfter("")}>Latest observations</button>
            )}
            {data.history.nextCursor && (
              <button onClick={() => setAfter(data.history.nextCursor!)}>
                Earlier observations
              </button>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export function PaymentExceptionQueue() {
  const [data, setData] = useState<{
      items: {
        id: string;
        provider_id: string | null;
        state: string;
        amount_paise: string;
        checked_at: string | null;
        last_error_code: string | null;
        review_required: boolean;
        failures: number;
      }[];
      nextCursor: string | null;
    } | null>(null),
    [error, setError] = useState(""),
    [after, setAfter] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api(
      "/admin/payment-exceptions" +
        (after ? "?after=" + encodeURIComponent(after) : ""),
      { signal: c.signal },
    )
      .then((r) => {
        if (!c.signal.aborted) setData(r as typeof data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorText(e));
      });
    return () => c.abort();
  }, [after]);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Payment reconciliation exceptions</h1>
      <p>
        Includes unresolved provider orders even when no payment attempt exists.
        This is provider-status recovery, not bank-settlement reconciliation. No
        automatic refund is implied.
      </p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading exceptions…</p>}
      {data && (
        <>
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Provider order</th>
                <th>State</th>
                <th>Amount</th>
                <th>Review</th>
                <th>Error / failures</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={"/admin/payments?booking=" + r.id}>{r.id}</a>
                  </td>
                  <td>{r.provider_id ?? "Unknown"}</td>
                  <td>{r.state}</td>
                  <td>{dashboardMoney(r.amount_paise)}</td>
                  <td>{r.review_required ? "Required" : "Worker retry"}</td>
                  <td>
                    {r.last_error_code ?? "No code"} / {r.failures}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && <p>No current exceptions.</p>}
          {after && <button onClick={() => setAfter("")}>First page</button>}
          {data.nextCursor && (
            <button onClick={() => setAfter(data.nextCursor!)}>
              Next page
            </button>
          )}
        </>
      )}
    </main>
  );
}
