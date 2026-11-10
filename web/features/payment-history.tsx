import { useEffect, useState } from "react";
import { api, money } from "../api.ts";
import type { PaymentHistoryPage } from "../../src/modules/payments/contracts/history.ts";
const labels = {
  capture_recorded: "Payment capture recorded",
  recovery_recorded: "Payment recovery recorded",
  attempt_created: "Attempt observed as created",
  attempt_authorized: "Attempt observed as authorized",
  attempt_captured: "Attempt observed as captured",
  attempt_refunded: "Attempt observed as refunded",
  attempt_failed: "Attempt observed as failed",
};
export function PaymentHistoryEntries({
  items,
}: Pick<PaymentHistoryPage, "items">) {
  return items.length ? (
    <ol>
      {items.map((item) => (
        <li key={`${item.kind}:${item.id}`}>
          <strong>{labels[item.kind]}</strong>
          {" — "}
          {money(item.amountPaise)}
          {item.attemptId && <p>Attempt reference: {item.attemptId}</p>}
          <p>
            <time dateTime={item.occurredAt}>
              {new Date(item.occurredAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              (India time)
            </time>
          </p>
        </li>
      ))}
    </ol>
  ) : (
    <p>No recorded payment events on this page.</p>
  );
}
export function PaymentHistoryPanel({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const [after, setAfter] = useState<string | null>(null),
    [page, setPage] = useState<PaymentHistoryPage | null>(null),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0),
    [category, setCategory] = useState("all"),
    [attemptId, setAttemptId] = useState(""),
    [filters, setFilters] = useState({ category: "all", attemptId: "" });
  useEffect(() => {
    setAfter(null);
  }, [id, revision]);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    const query = new URLSearchParams({
      category: filters.category,
      ...(filters.attemptId ? { attemptId: filters.attemptId } : {}),
      ...(after ? { after } : {}),
    });
    api<PaymentHistoryPage>(
      `/bookings/${encodeURIComponent(id)}/payment-history?${query}`,
    )
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision, after, refresh, filters]);
  return (
    <section aria-label="Payment history">
      <h2>Payment history</h2>
      <p>
        Newest records first. Times show when this platform recorded an
        observation, capture or recovery, not necessarily when the provider
        processed it. A capture does not guarantee booking confirmation; a
        recovery record does not confirm a refund.
      </p>
      <p>
        Attempt observations are available only from when history tracking was
        enabled. They describe accepted observations, not a complete provider
        event sequence. An observed refunded status is not a complete booking
        refund ledger. Check current payment and booking status for available
        actions; disruption history is not included.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({
            category,
            attemptId: category === "attempts" ? attemptId.trim() : "",
          });
          setAfter(null);
        }}
      >
        <label>
          Payment record type
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All payment records</option>
            <option value="captures">Captures</option>
            <option value="recovery">Recovery records</option>
            <option value="attempts">Attempt observations</option>
          </select>
        </label>
        {category === "attempts" && (
          <label>
            Attempt reference (optional)
            <input
              value={attemptId}
              maxLength={36}
              onChange={(event) => setAttemptId(event.target.value)}
              placeholder="Copy a reference from an observation"
            />
          </label>
        )}
        <button>Apply payment filters</button>
        <button
          type="button"
          onClick={() => {
            setCategory("all");
            setAttemptId("");
            setFilters({ category: "all", attemptId: "" });
            setAfter(null);
          }}
        >
          Clear payment filters
        </button>
      </form>
      <p>
        Applied view: {filters.category}
        {filters.attemptId ? ` · Attempt ${filters.attemptId}` : ""}
      </p>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRefresh((v) => v + 1)}>
            Retry payment history
          </button>
        </>
      ) : !page ? (
        <p role="status">Loading payment history…</p>
      ) : (
        <>
          <PaymentHistoryEntries items={page.items} />
          <nav aria-label="Payment history pages">
            <button
              onClick={() => {
                setAfter(null);
                setRefresh((v) => v + 1);
              }}
            >
              Newest payment records
            </button>
            {page.nextCursor && (
              <button onClick={() => setAfter(page.nextCursor)}>
                Older payment records
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
