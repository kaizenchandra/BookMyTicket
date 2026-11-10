import React, { useEffect, useState } from "react";
import { api } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import { dashboardMoney } from "./admin-money.ts";
type Supplier = {
  id: string;
  code: string;
  name: string;
  airlineCodes: string[];
  environment: string;
  status: string;
  version: number;
};
type Rule = { version: number; markup_bps: number; service_fee_paise: string };
function useData<T>(path: string, revision: number) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    setData(null);
    setError("");
    api<T>(path, { signal: c.signal })
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function SupplierForm({
  supplier,
  onSaved,
}: {
  supplier?: Supplier;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [key, setKey] = useState(crypto.randomUUID()),
    [fingerprint, setFingerprint] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget),
          body = {
            code: form.get("code"),
            name: form.get("name"),
            airlineCodes: String(form.get("airlines"))
              .split(",")
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean),
            environment: form.get("environment"),
            reason: form.get("reason"),
            ...(supplier
              ? {
                  expectedVersion: supplier.version,
                  status: form.get("status"),
                }
              : {}),
          },
          serialized = JSON.stringify(body),
          requestKey =
            fingerprint && fingerprint !== serialized
              ? crypto.randomUUID()
              : key;
        setKey(requestKey);
        setFingerprint(serialized);
        setBusy(true);
        setError("");
        try {
          const result = await api<{ id: string }>(
            "/admin/flights/suppliers" + (supplier ? "/" + supplier.id : ""),
            {
              method: supplier ? "PATCH" : "POST",
              headers: { "Idempotency-Key": requestKey },
              body: serialized,
            },
          );
          if (supplier) onSaved();
          else location.assign("/admin/flights/" + result.id);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {supplier ? "Edit supplier profile" : "Register supplier profile"}
      </h2>
      <label>
        Stable supplier code
        <input
          name="code"
          defaultValue={supplier?.code}
          required
          readOnly={!!supplier}
          pattern="[a-z][a-z0-9_-]{1,39}"
          maxLength={40}
        />
      </label>
      <label>
        Supplier name
        <input
          name="name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={supplier?.name}
        />
      </label>
      <label>
        Airline IATA codes (comma-separated)
        <input
          name="airlines"
          defaultValue={supplier?.airlineCodes.join(", ")}
        />
      </label>
      <label>
        Environment
        <select
          name="environment"
          defaultValue={supplier?.environment ?? "sandbox"}
        >
          <option value="sandbox">Sandbox</option>
          <option value="production">Production</option>
        </select>
      </label>
      {supplier && (
        <label>
          Profile status
          <select name="status" defaultValue={supplier.status}>
            <option value="draft">Draft</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      )}
      <label>
        Reason
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      {supplier && (
        <label>
          <input type="checkbox" required />I confirm these supplier profile
          changes.
        </label>
      )}
      <button disabled={busy}>{busy ? "Saving…" : "Save supplier"}</button>
      {error && <p role="alert">{error}</p>}
      <p>
        Profile registration does not connect or activate a supplier. Do not
        enter API credentials in these fields.
      </p>
    </form>
  );
}
function Commercial({
  id,
  rule,
  onSaved,
}: {
  id: string;
  rule: Rule | null;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<Record<string, string> | null>(null);
  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api("/admin/flights/suppliers/" + id + "/commercial-rule", {
              method: "PUT",
              body: JSON.stringify({
                expectedVersion: rule?.version ?? 0,
                markupBps: Number(f.get("bps")),
                serviceFeePaise: f.get("fee"),
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
        <h2>Commercial rule</h2>
        <p>
          INR only. Markup applies to base fare, rounded half up to a paise;
          supplied tax is passed through. This rule is not yet connected to
          flight checkout. Commission and additional tax treatment require
          supplier and business agreements.
        </p>
        <label>
          Markup (basis points; 100 = 1%)
          <input
            name="bps"
            type="number"
            required
            min={0}
            max={10000}
            step={1}
            defaultValue={rule?.markup_bps ?? 0}
          />
        </label>
        <label>
          Service fee (paise)
          <input
            name="fee"
            required
            inputMode="numeric"
            pattern="0|[1-9][0-9]{0,8}"
            defaultValue={rule?.service_fee_paise ?? "0"}
          />
        </label>
        <label>
          Reason
          <textarea name="reason" required minLength={10} maxLength={1000} />
        </label>
        <label>
          <input type="checkbox" required />I confirm the commercial rule
          change.
        </label>
        <button disabled={busy}>Save rule</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {rule && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError("");
            setPreview(null);
            setBusy(true);
            try {
              setPreview(
                await api("/admin/flights/suppliers/" + id + "/price-preview", {
                  method: "POST",
                  body: JSON.stringify({
                    basePaise: f.get("base"),
                    taxPaise: f.get("tax"),
                  }),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Arithmetic preview</h3>
          <p>
            Manually entered amounts; not a supplier quote or live fare. Rule
            version {rule.version}.
          </p>
          <label>
            Base fare (paise)
            <input
              name="base"
              inputMode="numeric"
              pattern="0|[1-9][0-9]{0,17}"
              required
            />
          </label>
          <label>
            Supplier tax (paise)
            <input
              name="tax"
              inputMode="numeric"
              pattern="0|[1-9][0-9]{0,17}"
              required
            />
          </label>
          <button disabled={busy}>Calculate preview</button>
          {preview && (
            <dl>
              {[
                "basePaise",
                "taxPaise",
                "markupPaise",
                "serviceFeePaise",
                "totalPaise",
              ].map((k) => (
                <React.Fragment key={k}>
                  <dt>{k.replace("Paise", "")}</dt>
                  <dd>{dashboardMoney(preview[k])}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </form>
      )}
    </>
  );
}
export function AdminFlights({ id }: { id?: string }) {
  const grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    { data, error } = useData<{
      items?: Supplier[];
      nextCursor?: string | null;
      supplier?: Supplier;
      rule: Rule | null;
      integration?: { message: string };
    }>(
      id
        ? "/admin/flights/suppliers/" + id
        : "/admin/flights/suppliers" + location.search,
      revision,
    ),
    reload = () => setRevision((n) => n + 1),
    params = new URLSearchParams(location.search);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Flight supplier administration</h1>
      <p role="status">
        Flight integration is not configured. Live schedules, fares,
        availability, PNRs, tickets, disruptions and supplier synchronization
        cannot be retrieved until an authorized supplier is connected.
      </p>
      {id && <a href="/admin/flights">All suppliers</a>}
      <button onClick={reload}>Reload</button>
      {error && (
        <p role="alert">
          {error} <a href="/profile">Account & MFA</a>
        </p>
      )}
      {!data && !error && <p>Loading…</p>}
      {!id && (
        <>
          <form method="get">
            <label>
              Supplier name or code
              <input name="q" defaultValue={params.get("q") ?? ""} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={params.get("status") ?? ""}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <button>Search suppliers</button>
            <a href="/admin/flights">Clear</a>
          </form>
          {data?.items && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Supplier</th>
                      <th>Airlines</th>
                      <th>Environment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <a href={"/admin/flights/" + s.id}>{s.name}</a>
                          <br />
                          {s.code}
                        </td>
                        <td>{s.airlineCodes.join(", ") || "Not specified"}</td>
                        <td>{s.environment}</td>
                        <td>{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && <p>No supplier profiles found.</p>}
              <nav aria-label="Supplier pagination">
                {params.has("after") && (
                  <a href={adminPageLink("/admin/flights", location.search)}>
                    First page
                  </a>
                )}{" "}
                {data.nextCursor && (
                  <a
                    href={adminPageLink(
                      "/admin/flights",
                      location.search,
                      data.nextCursor,
                    )}
                  >
                    Next page
                  </a>
                )}
              </nav>
            </>
          )}
          {grants.includes("flights.manage") &&
            grants.includes("flights.read") && (
              <SupplierForm onSaved={reload} />
            )}
        </>
      )}
      {id && data?.supplier && (
        <>
          <h2>{data.supplier.name}</h2>
          <p>
            {data.supplier.code} · {data.supplier.environment} ·{" "}
            {data.supplier.status} · Version {data.supplier.version}
          </p>
          <p>{data.integration?.message}</p>
          {grants.includes("flights.manage") && (
            <SupplierForm
              key={data.supplier.version}
              supplier={data.supplier}
              onSaved={reload}
            />
          )}
          <h2>Saved pricing configuration</h2>
          {data.rule ? (
            <p>
              Markup: {data.rule.markup_bps} basis points · Service fee:{" "}
              {dashboardMoney(data.rule.service_fee_paise)} · Version{" "}
              {data.rule.version}
            </p>
          ) : (
            <p>No commercial rule configured.</p>
          )}
          {grants.includes("pricing") && (
            <Commercial
              key={data.rule?.version ?? 0}
              id={id}
              rule={data.rule}
              onSaved={reload}
            />
          )}
        </>
      )}
    </section>
  );
}
