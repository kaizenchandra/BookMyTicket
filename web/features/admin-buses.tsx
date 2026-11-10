import React, { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import { dashboardMoney } from "./admin-money.ts";
import type {
  Kind,
  Operator,
  Route,
  Service,
  Stop,
  Seat,
  Content,
} from "../../src/modules/buses/domain/catalogue.ts";
import type { BusRecord } from "../../src/modules/buses/application/administration.ts";
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
function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        type={type}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function Reference({
  kind,
  value,
  onChange,
}: {
  kind: "operators" | "routes";
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState(""),
    { data, error } = useData<{
      items: BusRecord[];
      nextCursor: string | null;
    }>(`/admin/buses/${kind}?status=active&q=${encodeURIComponent(q)}`);
  return (
    <fieldset>
      <legend>Select {kind === "operators" ? "operator" : "route"}</legend>
      <TextField
        label="Search active catalogue (first 25 matches)"
        value={q}
        onChange={setQ}
        required={false}
      />
      {error && <p role="alert">{error}</p>}
      <select
        aria-label={kind}
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select…</option>
        {value && !data?.items.some((r) => r.id === value) && (
          <option value={value}>Current reference: {value}</option>
        )}
        {data?.items.map((r) => (
          <option key={r.id} value={r.id}>
            {r.content.name} · {r.code}
          </option>
        ))}
      </select>
      {data?.nextCursor && (
        <p>Refine your search to find additional matches.</p>
      )}
    </fieldset>
  );
}
function Stops({
  label,
  stops,
  onChange,
}: {
  label: string;
  stops: Stop[];
  onChange: (stops: Stop[]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      {stops.map((s, i) => (
        <div key={i}>
          <TextField
            label="Stop name"
            value={s.name}
            onChange={(v) =>
              onChange(stops.map((x, n) => (n === i ? { ...x, name: v } : x)))
            }
          />
          <TextField
            label="Address"
            value={s.address}
            onChange={(v) =>
              onChange(
                stops.map((x, n) => (n === i ? { ...x, address: v } : x)),
              )
            }
          />
          <TextField
            label="Minutes after departure"
            value={s.offsetMinutes}
            type="number"
            onChange={(v) =>
              onChange(
                stops.map((x, n) =>
                  n === i ? { ...x, offsetMinutes: Number(v) } : x,
                ),
              )
            }
          />
          <button
            type="button"
            disabled={stops.length <= 1}
            onClick={() => onChange(stops.filter((_, n) => n !== i))}
          >
            Remove stop {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={stops.length >= 30}
        onClick={() =>
          onChange([
            ...stops,
            {
              name: "",
              address: "",
              offsetMinutes: (stops.at(-1)?.offsetMinutes ?? 0) + 30,
            },
          ])
        }
      >
        Add stop
      </button>
      <p>
        List stops in ascending time order. All drop-off points must follow all
        boarding points.
      </p>
    </fieldset>
  );
}
function SeatMap({ seats }: { seats: Seat[] }) {
  return (
    <section>
      <h3>Reference seat layout</h3>
      <p>
        All seat availability is unknown. These are catalogue positions and
        indicative INR fares, not supplier inventory.
      </p>
      {(["lower", "upper"] as const)
        .filter((deck) => seats.some((s) => s.deck === deck))
        .map((deck) => (
          <div key={deck}>
            <h4>{deck} deck</h4>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6,minmax(65px,1fr))",
                gap: 8,
                overflowX: "auto",
              }}
            >
              {seats
                .filter((s) => s.deck === deck)
                .map((s, i) => (
                  <div
                    key={i}
                    style={{
                      gridRow: s.row,
                      gridColumn: s.column,
                      border: "1px solid currentColor",
                      padding: 8,
                    }}
                    aria-label={`${s.label}, ${s.type}, availability unknown`}
                  >
                    {s.label}
                    <br />
                    {s.type}
                    <br />
                    {dashboardMoney(s.farePaise)}
                    <br />
                    Unknown
                  </div>
                ))}
            </div>
          </div>
        ))}
    </section>
  );
}
const defaults: Record<Kind, Content> = {
  operators: {
    name: "",
    contactEmail: "",
    contactPhone: "",
    supplierName: "",
    supplierReference: "",
    active: true,
  },
  routes: {
    name: "",
    origin: "",
    destination: "",
    boarding: [{ name: "", address: "", offsetMinutes: 0 }],
    dropping: [{ name: "", address: "", offsetMinutes: 60 }],
    active: true,
  },
  services: {
    name: "",
    operatorId: "",
    routeId: "",
    departure: "",
    arrival: "",
    amenities: [],
    seats: [
      {
        label: "1A",
        deck: "lower",
        row: 1,
        column: 1,
        type: "seater",
        farePaise: "0",
      },
    ],
    cancellationPolicy: "",
    freeCancellationHours: 24,
    penaltyBps: 10000,
  },
};
function Editor({
  kind,
  record,
  onSaved,
}: {
  kind: Kind;
  record?: BusRecord;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<Content>(
      record?.content ?? defaults[kind],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    request = useRef({ key: crypto.randomUUID(), body: "" });
  const operator = content as Operator,
    route = content as Route,
    service = content as Service;
  function change(key: string, value: unknown) {
    setContent((c) => ({ ...c, [key]: value }));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        let clean: Content = content;
        if (kind === "services") {
          const { routeSnapshot, ...s } = service;
          clean = {
            ...s,
            amenities: s.amenities.map((x) => x.trim()).filter(Boolean),
          };
        }
        const body = JSON.stringify({
          content: clean,
          reason: f.get("reason"),
          ...(record
            ? { expectedVersion: record.version }
            : { code: f.get("code") }),
        });
        if (request.current.body && request.current.body !== body)
          request.current.key = crypto.randomUUID();
        request.current.body = body;
        setBusy(true);
        setError("");
        try {
          const result = await api<{ id: string }>(
            `/admin/buses/${kind}${record ? "/" + record.id : ""}`,
            {
              method: record ? "PATCH" : "POST",
              headers: { "Idempotency-Key": request.current.key },
              body,
            },
          );
          if (record) onSaved();
          else location.assign(`/admin/buses?kind=${kind}&id=${result.id}`);
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>
        {record ? "Edit" : "Create"} {kind.slice(0, -1)}
      </h2>
      {!record && (
        <label>
          Stable catalogue code
          <input
            name="code"
            required
            pattern="[a-z][a-z0-9_-]{1,59}"
            maxLength={60}
          />
        </label>
      )}
      <TextField
        label="Name"
        value={content.name}
        onChange={(v) => change("name", v)}
      />
      {kind === "operators" && (
        <>
          {(
            [
              "contactEmail",
              "contactPhone",
              "supplierName",
              "supplierReference",
            ] as const
          ).map((k) => (
            <TextField
              key={k}
              label={k}
              type={k === "contactEmail" ? "email" : "text"}
              value={operator[k]}
              onChange={(v) => change(k, v)}
            />
          ))}
          <p>
            Supplier references are metadata. Do not enter API keys or
            passwords.
          </p>
        </>
      )}
      {kind === "routes" && (
        <>
          <TextField
            label="Origin city"
            value={route.origin}
            onChange={(v) => change("origin", v)}
          />
          <TextField
            label="Destination city"
            value={route.destination}
            onChange={(v) => change("destination", v)}
          />
          <Stops
            label="Boarding points"
            stops={route.boarding}
            onChange={(v) => change("boarding", v)}
          />
          <Stops
            label="Drop-off points"
            stops={route.dropping}
            onChange={(v) => change("dropping", v)}
          />
        </>
      )}
      {kind !== "services" && (
        <label>
          <input
            type="checkbox"
            checked={operator.active}
            onChange={(e) => change("active", e.target.checked)}
          />
          Active catalogue reference
        </label>
      )}
      {kind === "services" && (
        <>
          <Reference
            kind="operators"
            value={service.operatorId}
            onChange={(v) => change("operatorId", v)}
          />
          <Reference
            kind="routes"
            value={service.routeId}
            onChange={(v) => change("routeId", v)}
          />
          <TextField
            label="Departure (ISO timestamp, e.g. 2027-01-01T09:00:00+05:30)"
            value={service.departure}
            onChange={(v) => change("departure", v)}
          />
          <TextField
            label="Arrival (ISO timestamp with timezone)"
            value={service.arrival}
            onChange={(v) => change("arrival", v)}
          />
          <label>
            Amenities (one per line)
            <textarea
              value={service.amenities.join("\n")}
              onChange={(e) => change("amenities", e.target.value.split("\n"))}
            />
          </label>
          <label>
            Cancellation rules (reference only)
            <textarea
              required
              minLength={10}
              maxLength={3000}
              value={service.cancellationPolicy}
              onChange={(e) => change("cancellationPolicy", e.target.value)}
            />
          </label>
          <TextField
            label="Free cancellation cutoff (hours before departure)"
            type="number"
            value={service.freeCancellationHours}
            onChange={(v) => change("freeCancellationHours", Number(v))}
          />
          <TextField
            label="Penalty after cutoff (basis points; 10000 = 100%)"
            type="number"
            value={service.penaltyBps}
            onChange={(v) => change("penaltyBps", Number(v))}
          />
          <fieldset>
            <legend>Reference seats</legend>
            {service.seats.map((seat, i) => (
              <details key={i}>
                <summary>{seat.label || "New seat"}</summary>
                {(["label", "row", "column", "farePaise"] as const).map((k) => (
                  <TextField
                    key={k}
                    label={
                      k === "farePaise" ? "Indicative fare (INR paise)" : k
                    }
                    type={k === "row" || k === "column" ? "number" : "text"}
                    value={seat[k]}
                    onChange={(v) =>
                      change(
                        "seats",
                        service.seats.map((x, n) =>
                          n === i
                            ? {
                                ...x,
                                [k]:
                                  k === "row" || k === "column" ? Number(v) : v,
                              }
                            : x,
                        ),
                      )
                    }
                  />
                ))}
                <label>
                  Deck
                  <select
                    value={seat.deck}
                    onChange={(e) =>
                      change(
                        "seats",
                        service.seats.map((x, n) =>
                          n === i ? { ...x, deck: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option>lower</option>
                    <option>upper</option>
                  </select>
                </label>
                <label>
                  Seat type
                  <select
                    value={seat.type}
                    onChange={(e) =>
                      change(
                        "seats",
                        service.seats.map((x, n) =>
                          n === i ? { ...x, type: e.target.value } : x,
                        ),
                      )
                    }
                  >
                    <option>seater</option>
                    <option>sleeper</option>
                  </select>
                </label>
                <button
                  type="button"
                  disabled={service.seats.length <= 1}
                  onClick={() =>
                    change(
                      "seats",
                      service.seats.filter((_, n) => n !== i),
                    )
                  }
                >
                  Remove seat
                </button>
              </details>
            ))}
            <button
              type="button"
              disabled={service.seats.length >= 100}
              onClick={() =>
                change("seats", [
                  ...service.seats,
                  {
                    label: "",
                    deck: "lower",
                    row: 1,
                    column: 1,
                    type: "seater",
                    farePaise: "0",
                  },
                ])
              }
            >
              Add seat
            </button>
          </fieldset>
          <SeatMap seats={service.seats} />
          <p>
            Saving refreshes the service's route snapshot from the selected
            route. It does not update supplier schedules or bookings.
          </p>
        </>
      )}
      <label>
        Reason
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <label>
        <input type="checkbox" required />I confirm these local catalogue
        changes.
      </label>
      <button disabled={busy}>
        {busy ? "Saving…" : "Save catalogue record"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
function Disruption({
  record,
  onSaved,
}: {
  record: BusRecord;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (record.status === "withdrawn")
    return (
      <p>
        Withdrawn service retained for history. Create a new service if needed.
      </p>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError("");
        setBusy(true);
        try {
          await api(`/admin/buses/services/${record.id}/disruptions`, {
            method: "POST",
            body: JSON.stringify({
              action: f.get("action"),
              expectedVersion: record.version,
              reason: f.get("reason"),
            }),
          });
          onSaved();
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>Record disruption / withdrawal</h3>
      <label>
        Action
        <select name="action">
          {record.status === "planned" ? (
            <option value="disrupt">Record disruption</option>
          ) : (
            <option value="resolve">Resolve disruption</option>
          )}
          <option value="withdraw">Withdraw local service</option>
        </select>
      </label>
      <label>
        Reason / incident details
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <label>
        <input type="checkbox" required />I confirm this local status change. No
        supplier cancellation, refund or customer notification is sent.
      </label>
      <button disabled={busy}>Save incident decision</button>
      {error && <p role="alert">{error}</p>}
    </form>
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
  const [before, setBefore] = useState<string>(),
    { data, error } = useData<{
      items: {
        id: string;
        action: string;
        reason: string;
        created_at: string;
        before_data: BusRecord | null;
        after_data: BusRecord;
      }[];
      nextBefore: string | null;
    }>(
      `/admin/buses/${kind}/${id}/history${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h2>Catalogue & incident history</h2>
      {error && <p role="alert">{error}</p>}
      {data?.items.map((h) => (
        <details key={h.id}>
          <summary>
            {h.action} · {new Date(h.created_at).toLocaleString()}
          </summary>
          <p>{h.reason}</p>
          <pre>
            {JSON.stringify(
              { before: h.before_data, after: h.after_data },
              null,
              2,
            )}
          </pre>
        </details>
      ))}
      <button disabled={!before} onClick={() => setBefore(undefined)}>
        Latest
      </button>{" "}
      <button
        disabled={!data?.nextBefore}
        onClick={() => setBefore(data!.nextBefore!)}
      >
        Older
      </button>
    </section>
  );
}
function ServiceView({ service: s }: { service: Service }) {
  return (
    <section>
      <p>
        Departure{" "}
        {new Date(s.departure).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}{" "}
        IST → Arrival{" "}
        {new Date(s.arrival).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}{" "}
        IST
      </p>
      <p>Amenities: {s.amenities.join(", ") || "None recorded"}</p>
      <p>
        Cancellation reference: {s.cancellationPolicy}. Free cutoff:{" "}
        {s.freeCancellationHours} hours; penalty after cutoff:{" "}
        {s.penaltyBps / 100}%.
      </p>
      {s.routeSnapshot && (
        <>
          <h3>
            {s.routeSnapshot.origin} → {s.routeSnapshot.destination}
          </h3>
          {(["boarding", "dropping"] as const).map((k) => (
            <div key={k}>
              <h4>{k}</h4>
              <ol>
                {s.routeSnapshot![k].map((stop, i) => (
                  <li key={i}>
                    {stop.name} · {stop.address} ·{" "}
                    {new Date(
                      Date.parse(s.departure) + stop.offsetMinutes * 60000,
                    ).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}{" "}
                    IST
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}
      <SeatMap seats={s.seats} />
      <dl>
        <dt>Live availability / booked seats</dt>
        <dd>Unknown — supplier not connected</dd>
        <dt>Booking confirmation / ticket status</dt>
        <dd>Unavailable — no supplier booking integration</dd>
      </dl>
    </section>
  );
}
export function AdminBuses() {
  const params = new URLSearchParams(location.search),
    kind = (
      ["operators", "routes", "services"].includes(params.get("kind") ?? "")
        ? params.get("kind")
        : "operators"
    ) as Kind,
    id = params.get("id"),
    grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    query = new URLSearchParams(params);
  query.delete("kind");
  query.delete("id");
  const { data, error } = useData<{
      items?: BusRecord[];
      nextCursor?: string | null;
      record?: BusRecord;
    }>(
      id
        ? `/admin/buses/${kind}/${encodeURIComponent(id)}`
        : `/admin/buses/${kind}?${query}`,
      revision,
    ),
    reload = () => setRevision((n) => n + 1);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Bus management</h1>
      <nav aria-label="Bus catalogue">
        {(["operators", "routes", "services"] as const).map((k) => (
          <a
            key={k}
            href={"/admin/buses?kind=" + k}
            aria-current={k === kind ? "page" : undefined}
          >
            {k}{" "}
          </a>
        ))}
      </nav>
      <p role="status">
        Supplier integration is not configured. This workspace manages reference
        catalogue data and local incidents. Fares, seat availability, holds and
        ticket confirmations are not live.
      </p>
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
            <input type="hidden" name="kind" value={kind} />
            <label>
              Name or code
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
            {kind === "services" &&
              ["operatorId", "routeId", "from", "until"].map((k) => (
                <label key={k}>
                  {k}{" "}
                  {k === "from" || k === "until"
                    ? "(departure ISO timestamp with timezone)"
                    : ""}
                  <input name={k} defaultValue={params.get(k) ?? ""} />
                </label>
              ))}
            <button>Search</button>
            <a href={"/admin/buses?kind=" + kind}>Clear</a>
          </form>
          {data?.items && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Version</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <a href={`/admin/buses?kind=${kind}&id=${r.id}`}>
                            {r.content.name}
                          </a>
                        </td>
                        <td>{r.code}</td>
                        <td>{r.status}</td>
                        <td>{r.version}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && <p>No matching records.</p>}
              {params.has("after") && (
                <a href={adminPageLink("/admin/buses", location.search)}>
                  First page
                </a>
              )}{" "}
              {data.nextCursor && (
                <a
                  href={adminPageLink(
                    "/admin/buses",
                    location.search,
                    data.nextCursor,
                  )}
                >
                  Next page
                </a>
              )}
            </>
          )}
          {grants.includes("buses.manage") && grants.includes("buses.read") && (
            <Editor key={kind} kind={kind} onSaved={reload} />
          )}
        </>
      )}
      {data?.record && (
        <>
          <h2>{data.record.content.name}</h2>
          <p>
            {data.record.code} · {data.record.status} · Version{" "}
            {data.record.version}
          </p>
          {kind === "services" ? (
            <ServiceView service={data.record.content as Service} />
          ) : (
            <pre>{JSON.stringify(data.record.content, null, 2)}</pre>
          )}
          {grants.includes("buses.manage") && (
            <>
              {data.record.status !== "withdrawn" && (
                <Editor
                  key={data.record.id + ":" + data.record.version}
                  kind={kind}
                  record={data.record}
                  onSaved={reload}
                />
              )}{" "}
              {kind === "services" && (
                <Disruption
                  key={"d" + data.record.version}
                  record={data.record}
                  onSaved={reload}
                />
              )}
            </>
          )}
          <History
            key={revision}
            kind={kind}
            id={data.record.id}
            revision={revision}
          />
        </>
      )}
    </section>
  );
}
