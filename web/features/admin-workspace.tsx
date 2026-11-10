import {PaymentReportExport} from "./payment-management.tsx";
import {BookingOperations} from "./booking-operations.tsx";
import React, { useEffect, useState } from "react";
import { api } from "../api.ts";
import { dashboardMoney } from "./admin-money.ts";
const permissions = [
  "access.manage",
  "customers.read",
  "bookings.read",
  "finance",
  "support",
  "moderate",
  "pricing",
  "audit",
];
const sections = [
  ["cabs.read", "Cabs & transfers", "/admin/cabs"],
  ["packages.read", "Holiday packages", "/admin/packages"],
  ["trains.read", "Train management", "/admin/trains"],
  ["buses.read", "Bus management", "/admin/buses"],
  ["hotels.read", "Hotels & properties", "/admin/hotels"],
  ["flights.read", "Flight suppliers", "/admin/flights"],
  ["finance", "Dashboard", "/admin/dashboard"],
  ["finance", "Payments", "/admin/payments"],
  ["finance", "Payment exceptions", "/admin/payment-exceptions"],
  ["finance", "Refund recovery", "/admin/refunds"],
  ["access.manage", "Staff access", "/admin/users"],
  ["access.manage", "Roles", "/admin/roles"],
  ["customers.read", "Customers", "/admin/customers"],
  ["bookings.read", "Bookings", "/admin/bookings"],
  ["moderate", "Provider approvals", "/admin"],
  ["moderate", "Listing approvals", "/admin/listings"],
  ["pricing", "Pricing", "/admin/pricing"],
  ["support", "Support", "/operations"],
  ["audit", "Audit", "/admin/audit"],
] as const;
export function useAdminCapabilities() {
  const [grants, setGrants] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    api<{ permissions: string[] }>("/admin/capabilities")
      .then((r) => {
        if (active) setGrants(r.permissions);
      })
      .catch(() => {
        if (active) setGrants([]);
      });
    return () => {
      active = false;
    };
  }, []);
  return grants;
}
export function AdminNavigation() {
  const grants = useAdminCapabilities();
  return (
    <nav className="admin-navigation" aria-label="Admin modules">
      {sections
        .filter(([p]) => grants.includes(p))
        .map(([, label, path]) => (
          <a
            key={path}
            href={path}
            aria-current={location.pathname === path ? "page" : undefined}
          >
            {label}
          </a>
        ))}
      <a href="/profile">Account & MFA</a>
    </nav>
  );
}
function useResource<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: controller.signal })
      .then((d) => {
        if (!controller.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error };
}
function Pager({ cursor, base }: { cursor: string | null; base: string }) {
  const p = new URLSearchParams(location.search);
  p.delete("after");
  const first = p.toString();
  if (cursor) p.set("after", cursor);
  return (
    <nav aria-label="Results pages">
      <a href={`${base}?${first}`}>First page</a>
      {cursor && (
        <>
          {" "}
          · <a href={`${base}?${p}`}>Next page</a>
        </>
      )}
    </nav>
  );
}
type Account = {
  id: string;
  contact: string;
  status: "active" | "suspended";
  created_at: string;
  version: number;
  permissions?: string[];
};
export function AdminAccounts({ staff }: { staff: boolean }) {
  const grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<Account | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const path = staff ? "/admin/users" : "/admin/customers",
    params = new URLSearchParams(location.search),
    { data, error: loadError } = useResource<{
      items: Account[];
      nextCursor: string | null;
    }>(path + location.search, revision);
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const f = new FormData(e.currentTarget);
    if (
      !window.confirm(
        "Apply this account change and revoke all of its sessions?",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedVersion: selected.version,
          reason: f.get("reason"),
          status: f.get("status"),
          ...(staff ? { permissions: f.getAll("permissions") } : {}),
        }),
      });
      setSelected(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>{staff ? "Staff access" : "Customer accounts"}</h1>
      <p>
        Contacts are masked. Search uses an exact account reference or exact
        registered contact. Customer accounts can also hold staff or partner
        access.
      </p>
      <form className="dashboard-controls" method="get">
        <label>
          Account reference
          <input name="id" defaultValue={params.get("id") ?? ""} />
        </label>
        <label>
          Exact contact
          <input name="contact" defaultValue={params.get("contact") ?? ""} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">All</option>
            <option>active</option>
            <option>suspended</option>
          </select>
        </label>
        <button>Search</button>
        <a href={path}>Clear</a>
      </form>
      {loadError ? (
        <p role="alert">{loadError}</p>
      ) : !data ? (
        <p role="status">Loading accounts…</p>
      ) : (
        <>
          <div className="dashboard-table dashboard-panel">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Masked contact</th>
                  <th>Status</th>
                  <th>Registered</th>
                  {staff && <th>Permissions</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code>{a.id}</code>
                    </td>
                    <td>{a.contact}</td>
                    <td>{a.status}</td>
                    <td>
                      {new Date(a.created_at).toLocaleDateString("en-IN")}
                    </td>
                    {staff && <td>{a.permissions?.join(", ")}</td>}
                    <td>
                      {grants.includes("bookings.read") && (
                        <a href={`/admin/bookings?customer=${a.id}`}>
                          Bookings
                        </a>
                      )}
                      {grants.includes("access.manage") && (
                        <button
                          onClick={() => {
                            setSelected(a);
                            setError("");
                          }}
                        >
                          Manage account
                        </button>
                      )}
                      {grants.includes("audit") && (
                        <a href={`/admin/audit?target=${a.id}`}>Activity</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && (
              <p>
                No accounts match. To grant initial staff access, locate an
                existing verified account in Customers.
              </p>
            )}
          </div>
          <Pager cursor={data.nextCursor} base={path} />
        </>
      )}
      {selected && (
        <section className="dashboard-panel">
          <h2>Manage {selected.contact}</h2>
          <p>
            Changes revoke all sessions. Reactivation does not restore old
            sessions. New staff must first register and verify their own
            contact.
          </p>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <label>
                Status
                <select name="status" defaultValue={selected.status}>
                  <option>active</option>
                  <option>suspended</option>
                </select>
              </label>
              {staff && (
                <fieldset>
                  <legend>Platform permissions</legend>
                  {permissions.map((p) => (
                    <label key={p} className="admin-permission">
                      <input
                        type="checkbox"
                        name="permissions"
                        value={p}
                        defaultChecked={selected.permissions?.includes(p)}
                      />
                      {p}
                    </label>
                  ))}
                  <p>Gate/tenant-scoped grants are retained.</p>
                </fieldset>
              )}
              <label>
                Reason (at least 10 characters)
                <textarea
                  name="reason"
                  minLength={10}
                  maxLength={1000}
                  required
                />
              </label>
              <button>{busy ? "Applying…" : "Apply account change"}</button>
              <button type="button" onClick={() => setSelected(null)}>
                Cancel
              </button>
            </fieldset>
          </form>
          {error && <p role="alert">{error}</p>}
          {!staff && (
            <a href={`/admin/users?id=${selected.id}`}>Manage staff access</a>
          )}
        </section>
      )}
    </main>
  );
}
type Booking = {
  id: string;
  customer_id: string;
  state: string;
  amount_paise: string;
  currency: string;
  created_at: string;
  confirmed_at: string | null;
  title: string;
};
export function AdminBookingList() {
  const params = new URLSearchParams(location.search),
    { data, error } = useResource<{
      items: Booking[];
      nextCursor: string | null;
    }>("/admin/bookings" + location.search);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>All bookings</h1>
      <p>Movies, events and sports. Travel supplier bookings and PNRs are not connected. Stalled means pending payment for over 30 minutes; it does not prove payment failure.</p>
      <p>
        Newest created first. Booking state is separate from payment and ticket
        fulfillment. Times below use your browser’s time zone; date filters
        require explicit offsets.
      </p>
      <form className="dashboard-controls" method="get">
        {[
          ["id", "Booking reference"],
          ["customer", "Customer reference"],
          ["supplier", "Supplier / organizer UUID"],
          ["travelFrom", "Travel/session starts from (ISO timestamp)"],
          ["travelUntil", "Travel/session starts before (ISO timestamp)"],
          ["assignedTo", "Exception assignee UUID"],
          ["from", "Created from (ISO timestamp)"],
          ["until", "Created before (ISO timestamp)"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input name={name} defaultValue={params.get(name) ?? ""} />
          </label>
        ))}
        <label>Product<select name="product" defaultValue={params.get('product')??''}><option value="">All supported products</option><option value="movie">Movies</option><option value="event">Events</option><option value="sports">Sports</option></select></label>
        <label>Exception queue<select name="exception" defaultValue={params.get('exception')??''}><option value="">All</option><option value="stalled">Pending payment over 30 minutes</option><option value="refund_required">Refund required</option><option value="open">Open cases</option><option value="escalated">Escalated cases</option><option value="resolved">Resolved cases</option></select></label>
        <label>
          Booking status
          <select name="state" defaultValue={params.get("state") ?? ""}>
            <option value="">All</option>
            {[
              "pending_payment",
              "confirmed",
              "refund_required",
              "cancelled",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Confirmation
          <select name="confirmed" defaultValue={params.get("confirmed") ?? ""}>
            <option value="">Any</option>
            <option value="true">Ever confirmed (GBV cohort)</option>
          </select>
        </label>
        <button>Apply</button>
        <a href="/admin/bookings">Clear</a>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading bookings…</p>
      ) : (
        <>
          <div className="dashboard-table dashboard-panel">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Listing</th>
                  <th>Customer reference</th>
                  <th>Created</th>
                  <th>Booking state</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <a href={`/admin/bookings/${b.id}`}>{b.id}</a>
                    </td>
                    <td>{b.title}</td>
                    <td>{b.customer_id}</td>
                    <td>{new Date(b.created_at).toLocaleString("en-IN")}</td>
                    <td>{b.state}</td>
                    <td>{dashboardMoney(b.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <p>No bookings match these filters.</p>}
          </div>
          <Pager cursor={data.nextCursor} base="/admin/bookings" />
        </>
      )}
    </main>
  );
}
type Payment = {
  id: string;
  kind: string;
  occurredAt: string;
  amountPaise: number;
};
type PaymentPage = { items: Payment[]; nextCursor: string | null };
type Detail = {
  booking: Booking & {
    policy_version: string;
    occurrences: {
      id: string;
      title: string;
      venueName: string;
      startsAt: string;
      timeZone: string;
      isDemo: boolean;
    }[];
    timeline: { kind: string; at: string }[];
  };
  fulfillment: { state: string; count: string }[];
  payments: PaymentPage;
};
export function AdminBookingDetail({ id }: { id: string }) {
  const { data, error } = useResource<Detail>(`/admin/bookings/${id}`),
    [payments, setPayments] = useState<PaymentPage | null>(null),
    [paymentError, setPaymentError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setPayments(data?.payments ?? null);
  }, [data]);
  async function more() {
    if (!payments?.nextCursor) return;
    setBusy(true);
    setPaymentError("");
    try {
      const next = await api<PaymentPage>(
        `/admin/bookings/${id}/payments?after=${encodeURIComponent(payments.nextCursor)}`,
      );
      setPayments((p) => ({
        items: [...(p?.items ?? []), ...next.items],
        nextCursor: next.nextCursor,
      }));
    } catch (e) {
      setPaymentError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>Booking details</h1>
      <a href="/admin/bookings">All bookings</a>
      {error ? (
        <p role="alert">{error}</p>
      ) : !data ? (
        <p role="status">Loading booking…</p>
      ) : (
        <>
          <section className="dashboard-panel">
            <h2>{id}</h2>
            <p>
              Booking: <strong>{data.booking.state}</strong> ·{" "}
              {dashboardMoney(data.booking.amount_paise)}
            </p>
            <p>Customer reference: {data.booking.customer_id}</p>
            <p>Accepted policy version: {data.booking.policy_version}</p>
            {data.booking.occurrences.map((o, n) => (
              <article key={n}>
                <h3>{o.title}</h3>
                <p>
                  {o.venueName} · {o.startsAt} ({o.timeZone}){" "}
                  {o.isDemo ? "· DEMO" : ""}
                </p>
              </article>
            ))}
          </section>
          <section className="dashboard-panel">
            <h2>Supplier confirmation</h2><p>Not applicable to platform-issued admission bookings. Travel supplier confirmations and PNRs are not connected.</p>
            <h2>Booking timeline</h2>
            <ol>
              {data.booking.timeline.map((e, n) => (
                <li key={n}>
                  {e.kind.replaceAll("_", " ")} ·{" "}
                  {new Date(e.at).toLocaleString("en-IN")}
                </li>
              ))}
            </ol>
          </section>
          <section className="dashboard-panel">
            <h2>Ticket fulfillment</h2>
            {data.fulfillment.length ? (
              data.fulfillment.map((f) => (
                <p key={f.state}>
                  {f.state}: {f.count}
                </p>
              ))
            ) : (
              <p>No ticket records issued.</p>
            )}
            <p>
              Ticket validity is separate from admission. Ticket tokens and
              customer documents are not exposed in this summary. Authorized managers can download the admission document below.
            </p>
          </section>
          <BookingOperations id={id} state={data.booking.state}/>
          <section className="dashboard-panel">
            <h2>Payment records</h2>
            <p>
              Recorded attempts, captures and recovery cases. Recovery does not
              mean a completed refund.
            </p>
            {payments?.items.length ? (
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Recorded at</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.items.map((e) => (
                    <tr key={e.id}>
                      <td>{e.kind.replaceAll("_", " ")}</td>
                      <td>{new Date(e.occurredAt).toLocaleString("en-IN")}</td>
                      <td>{dashboardMoney(String(e.amountPaise))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No payment records.</p>
            )}
            {payments?.nextCursor && (
              <button disabled={busy} onClick={more}>
                {busy ? "Loading…" : "Load earlier records"}
              </button>
            )}
            {paymentError && <p role="alert">{paymentError}</p>}
          </section>
        </>
      )}
    </main>
  );
}
export function AdminFinanceRecords({ recovery }: { recovery: boolean }) {
  const path = recovery ? "/admin/refunds" : "/admin/payments",
    params = new URLSearchParams(location.search),
    grants = useAdminCapabilities();
  const { data, error } = useResource<{
    items: {
      id: string;
      booking_id: string;
      state: string;
      amount_paise: string;
      created_at: string;
      transaction_id?:string;method?:string|null;error_reason?:string|null;
    }[];
    nextCursor: string | null;
  }>(path + location.search);
  return (
    <main className="admin-dashboard">
      <AdminNavigation />
      <h1>{recovery ? "Refund recovery cases" : "Payment attempts"}</h1>
      <p>
        {recovery
          ? "These are payment recovery obligations, not a completed-refund ledger. Awaiting review does not mean a refund was initiated."
          : "Latest observed provider attempt states. Captured or refunded status does not imply booking confirmation or a settlement."}
      </p>
      <form className="dashboard-controls" method="get">
        <label>
          Booking reference
          <input name="booking" defaultValue={params.get("booking") ?? ""} />
        </label>
        {!recovery&&<>{[['transaction','Transaction / attempt ID'],['from','Observed from (ISO timestamp)'],['until','Observed before (ISO timestamp)']].map(([name,label])=><label key={name}>{label}<input name={name} defaultValue={params.get(name)??''}/></label>)}<label>Provider<select name="provider" defaultValue={params.get('provider')??''}><option value="">All configured</option><option value="razorpay">Razorpay</option></select></label><label>Method<select name="method" defaultValue={params.get('method')??''}><option value="">All / unknown</option>{['card','upi','netbanking','wallet','emi','bank_transfer','paylater'].map(m=><option key={m}>{m}</option>)}</select></label><label>Status<select name="state" defaultValue={params.get('state')??''}><option value="">All</option>{['created','authorized','captured','refunded','failed'].map(m=><option key={m}>{m}</option>)}</select></label><label>Reconciliation<select name="exception" defaultValue={params.get('exception')??''}><option value="">All</option><option value="true">Exception attempts</option></select></label></>}
        <button>Filter</button>
        <a href={path}>Clear</a>
      </form>
      {!recovery&&<PaymentReportExport/>}
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
                  <th>Booking</th>
                  <th>{recovery ? "Recovery state" : "Provider state"}</th>
                  <th>
                    {recovery ? "Recovery amount" : "Original attempt amount"}
                  </th>
                  <th>Recorded / observed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>{recovery?r.id:<a href={`/admin/payments/${r.id}`}>{r.transaction_id??r.id}</a>}</td>
                    <td>
                      {grants.includes("bookings.read") ? (
                        <a href={`/admin/bookings/${r.booking_id}`}>
                          {r.booking_id}
                        </a>
                      ) : (
                        r.booking_id
                      )}
                    </td>
                    <td>
                      {r.state === "review_required"
                        ? "Awaiting review"
                        : r.state}
                    </td>
                    <td>{dashboardMoney(r.amount_paise)}</td>
                    <td>{new Date(r.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.items.length && <p>No records match.</p>}
          </div>
          <Pager cursor={data.nextCursor} base={path} />
        </>
      )}
    </main>
  );
}
