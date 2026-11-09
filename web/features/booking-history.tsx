import { useEffect, useState } from "react";
import { api, money } from "../api.ts";
const labels: Record<string, string> = {
  pending_payment: "Pending confirmation",
  confirmed: "Confirmed",
  refund_required: "Refund recovery required",
  cancelled: "Cancelled",
};
export function BookingHistory() {
  const [filters, setFilters] = useState(""),
    [cursor, setCursor] = useState(""),
    [revision, setRevision] = useState(0),
    [page, setPage] = useState<any>(null),
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
    const params = new URLSearchParams(filters);
    if (cursor) params.set("after", cursor);
    api(`/bookings?${params}`)
      .then((r) => {
        if (active) setPage(r);
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
  }, [filters, cursor, revision]);
  return (
    <section className="reading">
      <p className="eyebrow">YOUR EXPERIENCES</p>
      <h1>My bookings</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget),
            params = new URLSearchParams();
          for (const key of ["q", "state", "period"]) {
            const value = String(data.get(key) ?? "").trim();
            if (value) params.set(key, value);
          }
          for (const key of ["from", "until"]) {
            const value = String(data.get(key) ?? "");
            if (value) params.set(key, value + "T00:00:00+05:30");
          }
          setFilters(params.toString());
          setCursor("");
          setRevision((v) => v + 1);
        }}
      >
        <label>
          Booking reference or saved title
          <input name="q" maxLength={200} placeholder="Search your bookings" />
        </label>
        <label>
          Booking status
          <select name="state">
            <option value="">All statuses</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Experience timing
          <select name="period">
            <option value="">Any time</option>
            <option value="upcoming">
              Upcoming or in progress (confirmed)
            </option>
            <option value="past">Past (confirmed)</option>
          </select>
        </label>
        <label>
          Booked on or after (India time)
          <input name="from" type="date" />
        </label>
        <label>
          Booked before (India time)
          <input name="until" type="date" />
        </label>
        <button className="primary">Search bookings</button>
        <button
          type="reset"
          onClick={() => {
            setFilters("");
            setCursor("");
            setRevision((v) => v + 1);
          }}
        >
          Clear filters
        </button>
      </form>
      <p role="status" aria-live="polite">
        {loading
          ? "Loading your bookings…"
          : error ||
            (page ? `${page.items.length} bookings on this page.` : "")}
      </p>
      {error && (
        <button onClick={() => setRevision((v) => v + 1)}>Retry</button>
      )}
      {page && (
        <>
          {!page.items.length && (
            <p>
              No bookings match these filters. Clear filters to see all your
              bookings.
            </p>
          )}
          {page.items.map((b: any) => (
            <article className="organization" key={b.id}>
              <h2>
                <a href={`/bookings/${b.id}`}>
                  {b.occurrences.find((o: any) => o.title)?.title ??
                    `Booking ${b.id.slice(0, 8)}`}
                </a>
              </h2>
              <p>Reference: {b.id}</p>
              <p>
                {labels[b.state] ?? b.state} · {money(b.amount_paise)}
              </p>
              <p>
                Booked{" "}
                {new Date(b.created_at).toLocaleString("en-IN", {
                  timeZone: "Asia/Kolkata",
                })}{" "}
                (India time)
              </p>
              {b.occurrences.map((o: any) => (
                <p key={o.id}>
                  {o.title ?? "Historical title not recorded"} · {o.venueName} ·{" "}
                  {new Date(o.startsAt).toLocaleString("en-IN", {
                    timeZone: o.timeZone,
                  })}{" "}
                  ({o.timeZone})
                </p>
              ))}
              <p>
                Payment, ticket and refund statuses are available separately in
                booking details.
              </p>
            </article>
          ))}
          <p className="muted">
            Retrieved {new Date(page.serverTime).toLocaleString("en-IN")}.
            Experience timing uses saved session end times. Earlier bookings may
            not have a saved title.
          </p>
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
            onClick={() => setCursor(page.nextCursor)}
          >
            Older bookings
          </button>
        </>
      )}
    </section>
  );
}
