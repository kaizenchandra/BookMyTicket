import React, { useEffect, useState } from "react";
import { api } from "../api.ts";
import { AdminNavigation } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import { dashboardMoney } from "./admin-money.ts";
type Activity = {
  bookings: string;
  confirmed: string;
  cancelled: string;
  lastBookingAt: string | null;
};
type Account = {
  id: string;
  contact: string;
  status: string;
  version: number;
  flags: string[];
  created_at: string;
  contact_verification: string;
  contact_verified_at: string | null;
};
type Page<T> = { items: T[]; nextCursor: string | null };
type Detail = {
  account: Account;
  profile: {
    name: string;
    city: string | null;
    theme: string;
    version: number;
    savedAttendees: {
      available: boolean;
      items: { id: string; name: string; email: string; phone: string }[];
    };
    wallet: { supported: boolean };
    loyalty: { supported: boolean };
  };
  activity: Activity;
  permissions: {
    bookings: boolean;
    payments: boolean;
    support: boolean;
    manage: boolean;
  };
};
function useCustomerData<T>(path: string, revision = 0) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: c.signal })
      .then((r) => {
        if (!c.signal.aborted) setData(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "Not recorded";
}
function Verification({ account: a }: { account: Account }) {
  return (
    <span>
      {a.contact_verification === "verified"
        ? `OTP verified · ${date(a.contact_verified_at)}`
        : a.contact_verification === "verified_legacy"
          ? "Verified by historical OTP; date not recorded"
          : "Verification not recorded"}
    </span>
  );
}
function Status({ error, loading }: { error: string; loading: boolean }) {
  return error ? (
    <p role="alert">
      {error} <a href="/profile">Check account & MFA</a>
    </p>
  ) : loading ? (
    <p role="status">Loading customers…</p>
  ) : null;
}
export function AdminCustomers() {
  const search = location.search,
    params = new URLSearchParams(search),
    { data, error } = useCustomerData<
      Page<
        Account & {
          profile: { name: string; city: string | null };
          activity: Activity;
        }
      >
    >("/admin/customers" + search);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Customer management</h1>
      <p>
        Search customer profiles and review account activity. Contacts are
        masked. Times are shown in IST.
      </p>
      <form method="get" className="admin-filters">
        {[
          ["q", "Profile name"],
          ["contact", "Exact email or phone"],
          ["id", "Customer ID"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input name={name} defaultValue={params.get(name) ?? ""} />
          </label>
        ))}
        <label>
          Status
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        {[
          ["from", "Registered from"],
          ["until", "Registered before"],
          ["bookingFrom", "Activity from"],
          ["bookingUntil", "Activity before"],
        ].map(([name, label]) => (
          <label key={name}>
            {label}
            <input
              name={name}
              placeholder="2026-01-01T00:00:00+05:30"
              defaultValue={params.get(name) ?? ""}
            />
          </label>
        ))}
        <label>
          Booking activity
          <select
            name="activity"
            defaultValue={params.get("activity") ?? "all"}
          >
            <option value="all">All customers</option>
            <option value="has_bookings">Has bookings</option>
            <option value="no_bookings">No bookings</option>
            <option value="repeat_confirmed">
              Two or more confirmed bookings
            </option>
          </select>
        </label>
        <label>
          Sort
          <select name="sort" defaultValue={params.get("sort") ?? "newest"}>
            <option value="newest">Newest registration</option>
            <option value="oldest">Oldest registration</option>
          </select>
        </label>
        <button>Apply filters</button>
        <a href="/admin/customers">Clear</a>
        <p>
          Dates accept ISO timestamps with a timezone. Activity dates filter
          booking creation and require an activity selection. Counts below cover
          all time; confirmed includes subsequently cancelled bookings.
        </p>
      </form>
      <Status error={error} loading={!data} />
      {data && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Status / verification</th>
                  <th>Registered (IST)</th>
                  <th>All-time activity</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <a href={"/admin/customers/" + a.id}>
                        {a.profile.name || "Unnamed customer"}
                      </a>
                      <br />
                      {a.id}
                      <br />
                      {a.profile.city}
                    </td>
                    <td>{a.contact}</td>
                    <td>
                      {a.status}
                      <br />
                      <Verification account={a} />
                    </td>
                    <td>{date(a.created_at)}</td>
                    <td>
                      {a.activity.bookings} bookings · {a.activity.confirmed}{" "}
                      confirmed · {a.activity.cancelled} cancelled
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && <p>No matching customers.</p>}
          <nav aria-label="Customer pagination">
            {params.has("after") && (
              <a href={adminPageLink("/admin/customers", search)}>First page</a>
            )}{" "}
            {data.nextCursor && (
              <a
                href={adminPageLink(
                  "/admin/customers",
                  search,
                  data.nextCursor,
                )}
              >
                Next page
              </a>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
function CustomerHistory({
  id,
  kind,
  canBookings,
}: {
  id: string;
  kind: "bookings" | "payments" | "support";
  canBookings: boolean;
}) {
  const [cursor, setCursor] = useState<string | undefined>(),
    { data, error } = useCustomerData<
      Page<{
        id: string;
        state: string;
        label: string;
        amount_paise: string | null;
        at: string;
        booking_id?: string;
      }>
    >(
      `/admin/customers/${id}/history?kind=${kind}${cursor ? "&after=" + encodeURIComponent(cursor) : ""}`,
    );
  return (
    <div>
      <Status error={error} loading={!data} />
      {data && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Date (IST)</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.label}
                      <br />
                      {r.id}
                    </td>
                    <td>{r.state}</td>
                    <td>
                      {r.amount_paise === null
                        ? "—"
                        : dashboardMoney(r.amount_paise)}
                    </td>
                    <td>{date(r.at)}</td>
                    <td>
                      {kind === "support" ? (
                        <a href={"/operations?caseId=" + r.id}>Support case</a>
                      ) : r.booking_id && canBookings ? (
                        <a href={"/admin/bookings/" + r.booking_id}>Booking</a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length && <p>No {kind} records.</p>}
          <button disabled={!cursor} onClick={() => setCursor(undefined)}>
            First page
          </button>{" "}
          <button
            disabled={!data.nextCursor}
            onClick={() => setCursor(data.nextCursor!)}
          >
            Next page
          </button>
        </>
      )}
    </div>
  );
}
function CustomerStatus({
  detail: d,
  onSaved,
}: {
  detail: Detail;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api(`/admin/customers/${d.account.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({
              expectedVersion: d.account.version,
              status: f.get("status"),
              customerFlags: f.getAll("flag"),
              reason: f.get("reason"),
            }),
          });
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Account status & review flags</h2>
      <label>
        Status
        <select name="status" defaultValue={d.account.status}>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </label>
      <fieldset>
        <legend>Administrative flags</legend>
        {["review_required", "contact_support", "payment_review"].map(
          (flag) => (
            <label key={flag}>
              <input
                type="checkbox"
                name="flag"
                value={flag}
                defaultChecked={d.account.flags.includes(flag)}
              />
              {flag.replaceAll("_", " ")}
            </label>
          ),
        )}
      </fieldset>
      <label>
        Reason
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <label>
        <input type="checkbox" required />I confirm this change and understand
        that all customer sessions will be revoked.
      </label>
      <button disabled={busy}>
        {busy ? "Saving…" : "Save account change"}
      </button>
      {error && (
        <p role="alert">
          {error} Reload the profile if another administrator changed it.
        </p>
      )}
    </form>
  );
}
export function AdminCustomerDetail({ id }: { id: string }) {
  const [revision, setRevision] = useState(0),
    { data: d, error } = useCustomerData<Detail>(
      "/admin/customers/" + encodeURIComponent(id),
      revision,
    ),
    [kind, setKind] = useState<"bookings" | "payments" | "support">("bookings");
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <a href="/admin/customers">Customer directory</a>
      <h1>Customer profile</h1>
      <button onClick={() => setRevision((n) => n + 1)}>Reload profile</button>
      <Status error={error} loading={!d} />
      {d && (
        <>
          <h2>{d.profile.name || "Unnamed customer"}</h2>
          <dl>
            <dt>Customer ID</dt>
            <dd>{d.account.id}</dd>
            <dt>Contact (masked)</dt>
            <dd>
              {d.account.contact} · <Verification account={d.account} />
            </dd>
            <dt>Account status</dt>
            <dd>{d.account.status}</dd>
            <dt>Profile</dt>
            <dd>
              {d.profile.version ? "Saved profile" : "Profile not completed"} ·{" "}
              {d.profile.city || "City not supplied"}
            </dd>
            <dt>Registered</dt>
            <dd>{date(d.account.created_at)} IST</dd>
            <dt>Flags</dt>
            <dd>{d.account.flags.join(", ") || "None"}</dd>
            <dt>All-time booking activity</dt>
            <dd>
              {d.activity.bookings} bookings · {d.activity.confirmed} ever
              confirmed · {d.activity.cancelled} cancelled. Last booking:{" "}
              {date(d.activity.lastBookingAt)}
            </dd>
          </dl>
          <h2>Saved attendees</h2>
          {!d.profile.savedAttendees.available ? (
            <p>Saved attendee data is temporarily unavailable.</p>
          ) : d.profile.savedAttendees.items.length ? (
            <ul>
              {d.profile.savedAttendees.items.map((a) => (
                <li key={a.id}>
                  {a.name} · {a.email || "No email"} · {a.phone || "No phone"}
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved attendees with current consent.</p>
          )}
          <p>Wallet and loyalty balances are not supported by this platform.</p>
          {d.permissions.manage && (
            <CustomerStatus
              key={d.account.version}
              detail={d}
              onSaved={() => setRevision((n) => n + 1)}
            />
          )}
          <h2>Customer histories</h2>
          <div aria-label="History selection">
            {(["bookings", "payments", "support"] as const)
              .filter((k) => d.permissions[k])
              .map((k) => (
                <button
                  key={k}
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                >
                  {k}
                </button>
              ))}
          </div>
          {d.permissions[kind] ? (
            <CustomerHistory
              key={`${kind}:${revision}`}
              id={id}
              kind={kind}
              canBookings={d.permissions.bookings}
            />
          ) : (
            <p>
              Select an authorized history above. History access requires its
              corresponding booking, finance or support permission.
            </p>
          )}
        </>
      )}
    </section>
  );
}
