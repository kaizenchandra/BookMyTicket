import React, { useEffect, useState } from "react";
import { api } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { dashboardMoney } from "./admin-money.ts";
import type { z } from "zod";
import type {
  dashboardPage,
  dashboardRecordsPage,
} from "../../src/modules/reporting/adapters/dashboard-schema.ts";
export { dashboardMoney } from "./admin-money.ts";
type Data = z.infer<typeof dashboardPage>;
const date = (v: string) =>
  new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
const rate = (n: string, d: string) =>
  BigInt(d) === 0n
    ? "Not available"
    : `${Number((BigInt(n) * 10000n) / BigInt(d)) / 100}%`;
function initialQuery() {
  const p = new URLSearchParams(location.search),
    now = new Date(Date.now() + 330 * 60000);
  p.delete("snapshot");
  for (const [k, v] of [...p]) if (!v) p.delete(k);
  if (!p.has("year")) p.set("year", String(now.getUTCFullYear()));
  if (!p.has("group")) p.set("group", "month");
  if (!p.has("index"))
    p.set(
      "index",
      String(p.get("group") === "month" ? now.getUTCMonth() + 1 : 1),
    );
  return p;
}
export function dashboardRecordLink(data: Data, kind: string) {
  const day = (v: string) =>
    new Date(Date.parse(v) + 330 * 60000).toISOString().slice(0, 10);
  const p = new URLSearchParams({
    year: String(data.period.year),
    group: "year",
    index: "1",
    range: "custom",
    from: day(data.period.from),
    until: day(data.period.until),
    currency: "INR",
    kind,
  });
  for (const key of ["product", "city", "supplier", "state"] as const)
    if (data.filters[key]) p.set(key, data.filters[key]!);
  return `/admin/dashboard/records?${p}`;
}
function useReport<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: abort.signal })
      .then((d) => {
        if (!abort.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [path, revision]);
  return { data, error };
}
function Trend({ data, metric }: { data: Data; metric: "gbv" | "bookings" }) {
  const max = data.timeseries.reduce(
    (n, r) => (BigInt(r[metric]) > n ? BigInt(r[metric]) : n),
    1n,
  );
  return (
    <section className="dashboard-panel">
      <h2>
        {metric === "gbv" ? "Gross booking value" : "Booking count"} trend
      </h2>
      <p>
        {data.grain === "day" ? "Daily" : "Monthly"} India-time buckets.{" "}
        {metric === "gbv"
          ? "Confirmed booking value before cancellations; not net earnings."
          : "All bookings created, including pending and cancelled."}
      </p>
      <div className="dashboard-bars dashboard-trend-scroll" aria-hidden="true">
        {data.timeseries.map((r) => (
          <div key={r.bucket}>
            <span>{r.bucket}</span>
            <div
              style={{
                width: `${Number((BigInt(r[metric]) * 10000n) / max) / 100}%`,
              }}
            />
            <span>{metric === "gbv" ? dashboardMoney(r.gbv) : r.bookings}</span>
          </div>
        ))}
      </div>
      <details>
        <summary>Accessible chart data</summary>
        <div className="dashboard-table">
          <table>
            <caption>
              {metric === "gbv" ? "GBV" : "Booking count"} by {data.grain}
            </caption>
            <thead>
              <tr>
                <th>Period</th>
                <th>{metric === "gbv" ? "GBV (INR)" : "Bookings"}</th>
              </tr>
            </thead>
            <tbody>
              {data.timeseries.map((r) => (
                <tr key={r.bucket}>
                  <th>{r.bucket}</th>
                  <td>
                    {metric === "gbv" ? dashboardMoney(r.gbv) : r.bookings}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
function History({ revision }: { revision: number }) {
  const { data, error } = useReport<{
    items: {
      id: string;
      created_at: string;
      filters: Record<string, string>;
    }[];
  }>("/admin/dashboard/history", revision);
  return (
    <section className="dashboard-panel">
      <h2>Saved dashboard history</h2>
      <p>
        Latest 20 captures, created on report refresh. These preserve observed
        totals and definitions; they are not reconstructed day-end reports.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p>Loading report history…</p>
      ) : (
        <ul>
          {data.items.map((r) => (
            <li key={r.id}>
              <a href={`/admin/dashboard?snapshot=${r.id}`}>
                {date(r.created_at)}
              </a>{" "}
              · {r.filters.range ?? r.filters.group} ·{" "}
              {r.filters.product ?? "All products"} ·{" "}
              {r.filters.city ?? "All cities"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function AdminDashboard() {
  const query = initialQuery(),
    search = query.toString(),
    saved = new URLSearchParams(location.search).get("snapshot"),
    grants = useAdminCapabilities();
  const [revision, setRevision] = useState(0),
    [group, setGroup] = useState(query.get("group") ?? "month"),
    [range, setRange] = useState(query.get("range") ?? ""),
    [index, setIndex] = useState(query.get("index") ?? "1");
  const { data, error } = useReport<Data>(
    saved
      ? `/admin/dashboard/history/${encodeURIComponent(saved)}`
      : `/admin/dashboard?${search}`,
    revision,
  );
  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget))
      if (typeof v === "string" && v) p.set(k, v);
    if (p.get("range") !== "custom") {
      p.delete("from");
      p.delete("until");
    }
    p.set("index", group === "year" ? "1" : index);
    location.assign(`/admin/dashboard?${p}`);
  }
  const b = data?.bookings,
    p = data?.payments;
  const recovery =
    p?.recovery
      .filter((r) => r.state === "review_required")
      .reduce((n, r) => n + BigInt(r.cases), 0n)
      .toString() ?? "0";
  const cards =
    data && b && p
      ? [
          {
            label: "Total bookings",
            value: b.bookings,
            help: "Created in the selected period, across all selected booking states.",
            kind: "bookings",
            permission: "bookings.read",
          },
          {
            label: "Gross booking value",
            value: dashboardMoney(b.gbv),
            help: "Ever-confirmed orders created in period, before cancellations. Not net revenue.",
            kind: "confirmed",
            permission: "bookings.read",
          },
          {
            label: "Captured cash",
            value: dashboardMoney(p.captured_paise),
            help: "Capture records dated in period, including payment recovery obligations.",
            kind: "captures",
            permission: "finance",
          },
          {
            label: "Booking-active customers",
            value: b.active_customers,
            help: "Distinct customers who created a matching booking; not login activity or account status.",
            kind: "customers",
            permission: "customers.read",
          },
          {
            label: "Cancellations",
            value: b.cancelled,
            help: `Currently cancelled within the creation cohort. Cancellation rate: ${rate(b.cancelled, b.bookings)}.`,
            kind: "cancelled",
            permission: "bookings.read",
          },
          {
            label: "Recovery awaiting review",
            value: recovery,
            help: "Payment recovery cases created in period, still awaiting review. Not initiated refunds.",
            kind: "recovery",
            permission: "finance",
          },
          {
            label: "Provider-refunded attempts",
            value: p.provider_refunded_attempts,
            help: "Latest provider status observed in period. Completed refund amounts are unavailable.",
            kind: "refunded",
            permission: "finance",
          },
          {
            label: "Failed payment attempts",
            value: p.failed_attempts,
            help: "Latest failed provider attempts observed in period.",
            kind: "failed",
            permission: "finance",
          },
        ]
      : [];
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <header>
        <p>Administration · Finance</p>
        <h1>Dashboard & analytics</h1>
        <p>Movies, events and sports · INR</p>
      </header>
      {saved ? (
        <p role="status">
          Viewing a saved report.{" "}
          <a href="/admin/dashboard">Return to live dashboard</a>
        </p>
      ) : (
        <form className="dashboard-controls" onSubmit={apply}>
          <label>
            Date range
            <select
              name="range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="">Calendar period</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {range === "custom" && (
            <>
              <label>
                From (IST)
                <input
                  name="from"
                  type="date"
                  required
                  defaultValue={query.get("from") ?? ""}
                />
              </label>
              <label>
                Before (exclusive, IST)
                <input
                  name="until"
                  type="date"
                  required
                  defaultValue={query.get("until") ?? ""}
                />
              </label>
            </>
          )}
          <label>
            Calendar unit
            <select
              name="group"
              value={group}
              onChange={(e) => {
                setGroup(e.target.value);
                setIndex("1");
              }}
            >
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </label>
          <label>
            Year
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              required
              defaultValue={query.get("year") ?? ""}
            />
          </label>
          {group !== "year" && (
            <label>
              {group === "month" ? "Month" : "Quarter"}
              <select value={index} onChange={(e) => setIndex(e.target.value)}>
                {Array.from(
                  { length: group === "month" ? 12 : 4 },
                  (_, i) => i + 1,
                ).map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Product
            <select name="product" defaultValue={query.get("product") ?? ""}>
              <option value="">All supported products</option>
              <option value="movie">Movies</option>
              <option value="event">Events</option>
              <option value="sports">Sports</option>
            </select>
          </label>
          <label>
            City
            <input
              name="city"
              maxLength={100}
              placeholder="All cities"
              defaultValue={query.get("city") ?? ""}
            />
          </label>
          <label>
            Partner reference
            <input
              name="supplier"
              placeholder="All partners"
              defaultValue={query.get("supplier") ?? ""}
            />
          </label>
          <label>
            Booking state
            <select name="state" defaultValue={query.get("state") ?? ""}>
              <option value="">All states</option>
              {[
                "pending_payment",
                "confirmed",
                "cancelled",
                "refund_required",
              ].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Currency
            <select name="currency">
              <option>INR</option>
            </select>
          </label>
          <button>Apply filters</button>
          <a href="/admin/dashboard">Clear</a>
        </form>
      )}
      <button onClick={() => setRevision((r) => r + 1)}>
        {saved ? "Reload saved report" : "Refresh report"}
      </button>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading dashboard…</p>
      ) : (
        <>
          <p>
            Period: {date(data.period.from)} to {date(data.period.until)}{" "}
            (exclusive). Captured {date(data.asOf)}. Definitions v
            {data.definitionVersion}.{" "}
            {data.historical ? "Historical snapshot." : "Current snapshot."}{" "}
            <a href={`/admin/dashboard?snapshot=${data.snapshotId}`}>
              Saved report link
            </a>
          </p>
          <p>
            Filters: {data.filters.product ?? "all products"} ·{" "}
            {data.filters.city ?? "all cities"} · partner{" "}
            {data.filters.supplier ?? "all"} ·{" "}
            {data.filters.state ?? "all booking states"} · INR. Includes demo
            bookings ({b!.demo_bookings}). Geography/partner/product use current
            catalog classification. Mixed orders count in full when any
            component matches.
          </p>
          <section
            className="dashboard-cards"
            aria-label="Key performance indicators"
          >
            {cards.map((c) => (
              <article key={c.label}>
                <h2>{c.label}</h2>
                <strong>{c.value}</strong>
                <p>{c.help}</p>
                {!data.historical && grants.includes(c.permission) && (
                  <a href={dashboardRecordLink(data, c.kind)}>
                    View matching records
                  </a>
                )}
              </article>
            ))}
          </section>
          <section className="dashboard-panel">
            <h2>Operational alerts</h2>
            <p>
              Payment order exceptions: <strong>{p!.payment_exceptions}</strong>
              .{" "}
              {!data.historical && (
                <a href={dashboardRecordLink(data, "exceptions")}>
                  Inspect exceptions
                </a>
              )}
            </p>
            {data.support ? (
              <>
                <p>
                  Unresolved support cases:{" "}
                  <strong>{data.support.open_cases}</strong> · escalated:{" "}
                  {data.support.escalated_cases} · high/urgent:{" "}
                  {data.support.urgent_cases}.
                </p>
                {!data.historical && grants.includes("support") && (
                  <a href={dashboardRecordLink(data, "support")}>
                    Inspect matching open cases
                  </a>
                )}
              </>
            ) : (
              <p>
                Support alerts require support permission and are not included
                in this report.
              </p>
            )}
            <p>
              Alerts use records created in the selected period and their
              current states. Supplier synchronization failures are unavailable:
              this platform does not currently operate travel-supplier
              integrations.
            </p>
          </section>
          <Trend data={data} metric="gbv" />
          <Trend data={data} metric="bookings" />
          <section className="dashboard-panel">
            <h2>Product performance</h2>
            <p>
              All booking counts, ever-confirmed counts and GBV. Mixed or
              missing catalog classifications remain separate.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Bookings</th>
                  <th>Ever confirmed</th>
                  <th>GBV</th>
                </tr>
              </thead>
              <tbody>
                {data.verticals.map((v) => (
                  <tr key={v.kind}>
                    <th>{v.kind}</th>
                    <td>{v.bookings}</td>
                    <td>{v.confirmed}</td>
                    <td>{dashboardMoney(v.gbv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="dashboard-panel">
            <h2>Booking status breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>Current booking state</th>
                  <th>Bookings</th>
                  <th>Order value (not earnings)</th>
                </tr>
              </thead>
              <tbody>
                {b!.states.map((s) => (
                  <tr key={s.state}>
                    <th>{s.state.replaceAll("_", " ")}</th>
                    <td>{s.bookings}</td>
                    <td>{dashboardMoney(s.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!b!.states.length && <p>No matching bookings.</p>}
            <p>
              Average confirmed booking value:{" "}
              {BigInt(b!.confirmed)
                ? dashboardMoney(
                    (BigInt(b!.gbv) / BigInt(b!.confirmed)).toString(),
                  )
                : "Not available"}
              . Repeat booking rate: {rate(b!.repeat_customers, b!.customers)}.
            </p>
          </section>
          <section className="dashboard-panel">
            <h2>Inventory allocation</h2>
            <p>
              {data.inventory.occurrences} occurrences ·{" "}
              {data.inventory.capacity} total units · {data.inventory.sold} sold
              · {data.inventory.held} live holds · {data.inventory.unallocated}{" "}
              unallocated.
            </p>
            <p>
              Current allocation for occurrences starting in period.
              Product/city/partner filters apply; booking-state filtering does
              not apply to inventory. Includes closed/paused occurrences, so
              unallocated does not imply on sale.
            </p>
          </section>
          <section className="dashboard-panel">
            <h2>Refund recovery amounts</h2>
            {p!.recovery.length ? (
              <table>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Cases</th>
                    <th>Recovery amount</th>
                  </tr>
                </thead>
                <tbody>
                  {p!.recovery.map((r) => (
                    <tr key={r.state}>
                      <th>
                        {r.state === "review_required"
                          ? "Awaiting review"
                          : r.state}
                      </th>
                      <td>{r.cases}</td>
                      <td>{dashboardMoney(r.amount_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No matching recovery cases.</p>
            )}
            <p>
              Refund initiation, completed-refund counts/amounts and net
              earnings cannot be inferred from recovery cases or original
              payment amounts.
            </p>
          </section>
          <section className="dashboard-panel">
            <h2>Latest bookings</h2>
            <div className="dashboard-table">
              <table>
                <caption>Latest 20 matching bookings by creation time</caption>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Listing</th>
                    <th>Created (IST)</th>
                    <th>Booking state</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {b!.latest.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {grants.includes("bookings.read") ? (
                          <a href={`/admin/bookings/${r.id}`}>{r.id}</a>
                        ) : (
                          r.id
                        )}
                      </td>
                      <td>{r.title}</td>
                      <td>{date(r.created_at)}</td>
                      <td>{r.state}</td>
                      <td>{dashboardMoney(r.amount_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!b!.latest.length && <p>No matching bookings.</p>}
            </div>
            {data.historical && (
              <p>
                Opening a booking shows its current details, not its historical
                snapshot.
              </p>
            )}
          </section>
          <section className="dashboard-panel">
            <h2>Metric definitions</h2>
            <p>
              GBV includes bookings with recorded confirmation, including later
              cancellations; pending bookings contribute no GBV. Captures,
              failed/refunded attempts and recovery cases have separate
              event-date bases. Cash is not supplier margin or platform revenue.
              Customer count measures distinct booking creators; repeat rate
              measures customers with at least two confirmed orders within the
              cohort. Empty rate denominators are unavailable, not zero.
            </p>
            <p>
              Flights, hotels, buses, trains and cabs are not offered by this
              app. Unsupported products/currencies are rejected, and missing
              supplier/financial data is not displayed as zero.
            </p>
          </section>
          <History revision={revision + Number(!data.historical)} />
        </>
      )}
    </main>
  );
}
export function DashboardRecordList() {
  const params = new URLSearchParams(location.search),
    kind = params.get("kind") ?? "",
    grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    { data, error } = useReport<z.infer<typeof dashboardRecordsPage>>(
      `/admin/dashboard/records?${params}`,
      revision,
    );
  const next = new URLSearchParams(params);
  if (data?.nextCursor) next.set("after", data.nextCursor);
  const first = new URLSearchParams(params);
  first.delete("after");
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Dashboard records: {kind.replaceAll("_", " ")}</h1>
      <p>
        Current matching records for the dashboard’s pinned dates and filters.
        Original payment amounts on refunded attempts are not refund amounts.
      </p>
      <a
        href={`/admin/dashboard?${[...first]
          .filter(([k]) => k !== "kind")
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join("&")}`}
      >
        Return to filtered dashboard
      </a>
      <button onClick={() => setRevision((r) => r + 1)}>Refresh</button>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading records…</p>
      ) : (
        <>
          <div className="dashboard-table dashboard-panel">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Record</th>
                  <th>State</th>
                  <th>Amount</th>
                  <th>Time (IST)</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.label}</td>
                    <td>{r.state}</td>
                    <td>
                      {r.amount_paise === null
                        ? "—"
                        : dashboardMoney(r.amount_paise)}
                    </td>
                    <td>{date(r.at)}</td>
                    <td>
                      {r.booking_id && grants.includes("bookings.read") && (
                        <a href={`/admin/bookings/${r.booking_id}`}>Booking</a>
                      )}
                      {kind === "customers" &&
                        grants.includes("customers.read") && (
                          <a href={`/admin/customers?id=${r.id}`}>Customer</a>
                        )}
                      {kind === "support" && grants.includes("support") && (
                        <a href={`/operations?caseId=${r.id}`}>Support case</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <p>No matching records.</p>}
          </div>
          <nav aria-label="Results pages">
            <a href={`?${first}`}>First page</a>
            {data.nextCursor && (
              <>
                {" "}
                · <a href={`?${next}`}>Next page</a>
              </>
            )}
          </nav>
        </>
      )}
    </main>
  );
}
