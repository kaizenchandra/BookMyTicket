import React, { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { dashboardMoney } from "./admin-money.ts";
import type {
  Kind,
  Content,
  Service,
  QuoteInput,
} from "../../src/modules/cabs/domain/catalogue.ts";
import type { CabRecord } from "../../src/modules/cabs/application/administration.ts";
function errorText(e: unknown) {
  return e instanceof ApiError
    ? e.message +
        " " +
        (e.fields ?? [])
          .map((f) => f.path.join(".") + ": " + f.message)
          .join("; ")
    : (e as Error).message;
}
function useData<T>(path: string, revision = 0) {
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
        if (!c.signal.aborted) setError(errorText(e));
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
type Page = { items: CabRecord[]; nextCursor: string | null };
const defaults: Record<Kind, Content> = {
  suppliers: {
    name: "",
    contactEmail: "",
    contactPhone: "",
    supplierReference: "",
    active: true,
  },
  categories: {
    name: "",
    passengers: 4,
    luggage: 2,
    amenities: "",
    active: true,
  },
  services: {
    name: "",
    supplierId: "",
    categoryId: "",
    mode: "city",
    origin: "",
    destination: "",
    availableFrom: "",
    availableUntil: "",
    maxDistanceMeters: 100000,
    basePaise: "0",
    includedMeters: 0,
    perKmPaise: "0",
    includedWaitingMinutes: 0,
    waitingMinutePaise: "0",
    driverAllowancePaise: "0",
    airportFeePaise: "0",
    cancellationPolicy: "",
  },
};
const labels: Record<string, string> = {
  name: "Name",
  contactEmail: "Business email",
  contactPhone: "Business phone",
  supplierReference: "Supplier contract reference (no secrets)",
  active: "Active",
  passengers: "Maximum passengers",
  luggage: "Maximum luggage pieces",
  amenities: "Amenities",
  mode: "Service type",
  origin: "Origin city / airport code",
  destination: "Destination city / airport code",
  availableFrom: "Coverage start (ISO timestamp with timezone)",
  availableUntil: "Coverage end (ISO timestamp with timezone)",
  maxDistanceMeters: "Maximum trip distance (metres)",
  basePaise: "Base fare (paise)",
  includedMeters: "Included distance (metres)",
  perKmPaise: "Extra distance rate (paise per km)",
  includedWaitingMinutes: "Included waiting (minutes)",
  waitingMinutePaise: "Waiting rate (paise per minute)",
  driverAllowancePaise: "Driver allowance (paise per trip)",
  airportFeePaise: "Airport fee (paise per trip)",
  cancellationPolicy: "Cancellation / rescheduling policy",
  pickupAt: "Pickup time (ISO timestamp with timezone)",
  distanceMeters: "Trip distance (metres)",
  durationMinutes: "Total duration including waiting (minutes)",
  waitingMinutes: "Waiting (minutes)",
};
function Field({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string | number | boolean;
  onChange: (v: string | number | boolean) => void;
}) {
  if (typeof value === "boolean")
    return (
      <label>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {labels[name] ?? name}
      </label>
    );
  if (name === "mode")
    return (
      <label>
        Service type
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="city">City</option>
          <option value="airport">Airport transfer</option>
          <option value="outstation">Outstation</option>
        </select>
      </label>
    );
  if (name === "cancellationPolicy" || name === "amenities")
    return (
      <label>
        {labels[name]}
        <textarea
          required={name === "cancellationPolicy"}
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  return (
    <label>
      {labels[name] ?? name}
      <input
        required
        type={
          typeof value === "number"
            ? "number"
            : name === "contactEmail"
              ? "email"
              : "text"
        }
        min={typeof value === "number" ? 0 : undefined}
        step={typeof value === "number" ? 1 : undefined}
        value={value}
        onChange={(e) =>
          onChange(
            typeof value === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </label>
  );
}
function Reference({
  kind,
  value,
  onChange,
}: {
  kind: "suppliers" | "categories";
  value: string;
  onChange: (v: string) => void;
}) {
  const [search, setSearch] = useState(""),
    { data, error } = useData<Page>(
      "/admin/cabs/" + kind + "?status=active&q=" + encodeURIComponent(search),
    );
  return (
    <fieldset>
      <legend>{kind === "suppliers" ? "Supplier" : "Vehicle category"}</legend>
      <label>
        Search active records
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {error && <p role="alert">{error}</p>}
      <select
        aria-label={kind}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a record</option>
        {value && !data?.items.some((x) => x.id === value) && (
          <option value={value}>Current selection: {value}</option>
        )}
        {data?.items.map((x) => (
          <option key={x.id} value={x.id}>
            {x.content.name} ({x.code})
          </option>
        ))}
      </select>
      <small>Shows up to 25 matches. Refine the search to find more.</small>
    </fieldset>
  );
}
function Editor({
  kind,
  record,
  onSaved,
}: {
  kind: Kind;
  record?: CabRecord;
  onSaved: (id: string) => void;
}) {
  const [content, setContent] = useState<Content>(
      record?.content ?? defaults[kind],
    ),
    [code, setCode] = useState(""),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    key = useRef({ fingerprint: "", key: "" });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = record
          ? { content, reason, expectedVersion: record.version }
          : { code, content, reason },
        fingerprint = JSON.stringify(payload);
      if (key.current.fingerprint !== fingerprint)
        key.current = { fingerprint, key: crypto.randomUUID() };
      const result = await api<{ id: string }>(
        "/admin/cabs/" + kind + (record ? "/" + record.id : ""),
        {
          method: record ? "PATCH" : "POST",
          headers: { "idempotency-key": key.current.key },
          body: JSON.stringify(payload),
        },
      );
      onSaved(result.id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <h2>{record ? "Edit " + record.code : "Create " + kind}</h2>
      <fieldset disabled={busy}>
        {!record && (
          <label>
            Stable code
            <input
              required
              pattern="[a-z][a-z0-9_-]{1,59}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
        )}
        {Object.entries(content).map(([name, value]) =>
          name === "supplierId" || name === "categoryId" ? (
            <Reference
              key={name}
              kind={name === "supplierId" ? "suppliers" : "categories"}
              value={String(value)}
              onChange={(v) => setContent({ ...content, [name]: v })}
            />
          ) : (
            <Field
              key={name}
              name={name}
              value={value}
              onChange={(v) => setContent({ ...content, [name]: v })}
            />
          ),
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
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I have reviewed these catalogue and tariff changes.
        </label>
        <button>{busy ? "Saving…" : "Save"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function FarePreview({ record }: { record: CabRecord }) {
  const s = record.content as Service,
    [input, setInput] = useState<QuoteInput>({
      expectedVersion: record.version,
      pickupAt: s.availableFrom,
      origin: s.origin,
      destination: s.destination,
      passengers: 1,
      luggage: 0,
      distanceMeters: 1000,
      durationMinutes: 30,
      waitingMinutes: 0,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      lines: { label: string; paise: string }[];
      totalPaise: string;
      basis: string;
      exclusions: string[];
    } | null>(null);
  async function preview(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api("/admin/cabs/services/" + record.id + "/preview", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>Fare estimate</h2>
      <p>
        Enter a directional city/airport pair matching the service. Distances
        and duration are administrator estimates. Vehicle availability remains
        unknown.
      </p>
      <form onSubmit={preview}>
        <fieldset disabled={busy}>
          {Object.entries(input)
            .filter(([n]) => n !== "expectedVersion")
            .map(([name, value]) => (
              <Field
                key={name}
                name={name}
                value={value}
                onChange={(v) => {
                  setResult(null);
                  setInput({ ...input, [name]: v });
                }}
              />
            ))}
          <button>{busy ? "Calculating…" : "Calculate estimate"}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {result && (
        <div aria-live="polite">
          <table>
            <caption>INR fare breakdown</caption>
            <thead>
              <tr>
                <th>Charge</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l) => (
                <tr key={l.label}>
                  <td>{l.label}</td>
                  <td>{dashboardMoney(l.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <strong>Total estimate: {dashboardMoney(result.totalPaise)}</strong>
          <p>Excluded: {result.exclusions.join(", ")}.</p>
          <p>{result.basis}</p>
        </div>
      )}
    </section>
  );
}
function History({
  kind,
  id,
  revision,
}: {
  kind: Kind;
  id: string;
  revision: number;
}) {
  const [before, setBefore] = useState(""),
    { data, error } = useData<{
      items: {
        id: string;
        action: string;
        reason: string;
        created_at: string;
        before_data: CabRecord | null;
        after_data: CabRecord;
      }[];
      nextBefore: string | null;
    }>(
      `/admin/cabs/${kind}/${id}/history${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h2>Change history</h2>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading history…</p>}
      {data?.items.map((h) => (
        <article key={h.id}>
          <p>
            {h.action} · {new Date(h.created_at).toLocaleString("en-IN")} ·{" "}
            {h.reason}
          </p>
          <details>
            <summary>Before and after</summary>
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
      {before && <button onClick={() => setBefore("")}>Latest history</button>}
      {data?.nextBefore && (
        <button onClick={() => setBefore(data.nextBefore!)}>
          Earlier history
        </button>
      )}
    </section>
  );
}
function Detail({
  kind,
  id,
  manage,
}: {
  kind: Kind;
  id: string;
  manage: boolean;
}) {
  const [revision, setRevision] = useState(0),
    { data, error } = useData<{
      record: CabRecord;
      integration: { message: string };
    }>(`/admin/cabs/${kind}/${id}`, revision),
    [action, setAction] = useState("disrupt"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState("");
  async function change(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await api(`/admin/cabs/services/${id}/disruptions`, {
        method: "POST",
        body: JSON.stringify({
          action,
          reason,
          expectedVersion: data!.record.version,
        }),
      });
      setReason("");
      setRevision((r) => r + 1);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading record…</p>}
      {data && (
        <>
          <h2>{data.record.content.name}</h2>
          <p>
            {data.record.status} · Version {data.record.version}
          </p>
          <dl>
            {Object.entries(data.record.content).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{labels[k] ?? k}</dt>
                <dd>
                  {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <p role="status">{data.integration.message}</p>
          {kind === "services" && (
            <>
              <p>
                Trip / booking / cancellation status, actual charges and
                reconciliation: unavailable until a supplier is connected.
              </p>
              <FarePreview key={data.record.version} record={data.record} />
              {manage && data.record.status !== "withdrawn" && (
                <form onSubmit={change}>
                  <h2>Local service incident</h2>
                  <p>
                    These actions do not cancel reservations, notify suppliers
                    or issue refunds.
                  </p>
                  <fieldset disabled={busy}>
                    <label>
                      Action
                      <select
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                      >
                        <option value="disrupt">Mark disrupted</option>
                        <option value="resolve">Resolve disruption</option>
                        <option value="withdraw">Withdraw permanently</option>
                      </select>
                    </label>
                    <label>
                      Reason
                      <textarea
                        required
                        minLength={10}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <label>
                      <input type="checkbox" required />
                      Confirm the selected action
                    </label>
                    <button>Apply incident action</button>
                  </fieldset>
                  {actionError && <p role="alert">{actionError}</p>}
                </form>
              )}
            </>
          )}
          {manage && data.record.status !== "withdrawn" && (
            <Editor
              key={data.record.version}
              kind={kind}
              record={data.record}
              onSaved={() => setRevision((r) => r + 1)}
            />
          )}
          <History key={revision} kind={kind} id={id} revision={revision} />
        </>
      )}
    </>
  );
}
export function AdminCabs() {
  const params = new URLSearchParams(location.search),
    kind = (
      ["suppliers", "categories", "services"].includes(params.get("kind") ?? "")
        ? params.get("kind")
        : "suppliers"
    ) as Kind,
    id = params.get("id"),
    grants = useAdminCapabilities(),
    manage = grants.includes("cabs.manage");
  return (
    <main className="container">
      <AdminNavigation />
      <h1>Cabs & transfers</h1>
      <p>
        Manage supplier references, vehicle categories, service coverage and
        tariffs. No live cab supplier is connected.
      </p>
      <nav aria-label="Cab catalogue">
        {(["suppliers", "categories", "services"] as Kind[]).map((k) => (
          <a
            key={k}
            href={"/admin/cabs?kind=" + k}
            aria-current={kind === k ? "page" : undefined}
          >
            {k}{" "}
          </a>
        ))}
      </nav>
      {id ? (
        <Detail kind={kind} id={id} manage={manage} />
      ) : (
        <Catalogue kind={kind} manage={manage} />
      )}
    </main>
  );
}
function Catalogue({ kind, manage }: { kind: Kind; manage: boolean }) {
  const params = new URLSearchParams(location.search);
  params.delete("kind");
  const { data, error } = useData<Page>(
    "/admin/cabs/" + kind + "?" + params.toString(),
  );
  return (
    <>
      <form method="get">
        <input type="hidden" name="kind" value={kind} />
        <label>
          Search name/code
          <input name="q" defaultValue={params.get("q") ?? ""} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">All</option>
            {(kind === "services"
              ? ["planned", "disrupted", "withdrawn"]
              : ["active", "suspended"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {kind === "services" && (
          <>
            <label>
              Supplier ID
              <input
                name="supplierId"
                defaultValue={params.get("supplierId") ?? ""}
              />
            </label>
            <label>
              Category ID
              <input
                name="categoryId"
                defaultValue={params.get("categoryId") ?? ""}
              />
            </label>
            <label>
              Coverage overlaps from (ISO)
              <input name="from" defaultValue={params.get("from") ?? ""} />
            </label>
            <label>
              Coverage overlaps until (ISO)
              <input name="until" defaultValue={params.get("until") ?? ""} />
            </label>
          </>
        )}
        <button>Filter</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading catalogue…</p>}
      {data && (
        <>
          <table>
            <caption>Newest records first</caption>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`/admin/cabs?kind=${kind}&id=${r.id}`}>
                      {r.content.name}
                    </a>
                  </td>
                  <td>{r.code}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.items.length && <p>No matching records.</p>}
          {params.has("after") && (
            <a
              href={
                "/admin/cabs?" +
                new URLSearchParams([
                  ...Array.from(params.entries()).filter(
                    ([k]) => k !== "after",
                  ),
                  ["kind", kind],
                ])
              }
            >
              First page
            </a>
          )}
          {data.nextCursor && (
            <a
              href={
                "/admin/cabs?" +
                new URLSearchParams([
                  ...Array.from(params.entries()).filter(
                    ([k]) => k !== "after",
                  ),
                  ["kind", kind],
                  ["after", data.nextCursor],
                ])
              }
            >
              Next page
            </a>
          )}
        </>
      )}
      {manage && (
        <Editor
          kind={kind}
          onSaved={(id) => {
            location.href = `/admin/cabs?kind=${kind}&id=${id}`;
          }}
        />
      )}
    </>
  );
}
