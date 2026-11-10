import React, { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import type {
  Kind,
  Station,
  Route,
  Service,
  Stop,
  Content,
} from "../../src/modules/trains/domain/catalogue.ts";
import type { TrainRecord } from "../../src/modules/trains/application/administration.ts";
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
  kind: "stations" | "routes";
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState(""),
    { data, error } = useData<{
      items: TrainRecord[];
      nextCursor: string | null;
    }>(`/admin/trains/${kind}?status=active&q=${encodeURIComponent(q)}`);
  return (
    <fieldset>
      <legend>Select {kind === "stations" ? "station" : "route"}</legend>
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
            {r.content.name} ·{" "}
            {kind === "stations" ? (r.content as Station).stationCode : r.code}
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
  stops,
  onChange,
}: {
  stops: Stop[];
  onChange: (s: Stop[]) => void;
}) {
  return (
    <fieldset>
      <legend>Ordered station calls</legend>
      {stops.map((s, i) => (
        <div key={i}>
          <h4>Stop {i + 1}</h4>
          <Reference
            kind="stations"
            value={s.stationId}
            onChange={(v) =>
              onChange(
                stops.map((x, n) => (n === i ? { ...x, stationId: v } : x)),
              )
            }
          />
          {(["arrivalMinutes", "departureMinutes"] as const).map((k) => (
            <TextField
              key={k}
              label={
                k === "arrivalMinutes"
                  ? "Arrival offset (minutes)"
                  : "Departure offset (minutes)"
              }
              type="number"
              value={s[k]}
              onChange={(v) =>
                onChange(
                  stops.map((x, n) => (n === i ? { ...x, [k]: Number(v) } : x)),
                )
              }
            />
          ))}
          {(["boarding", "alighting"] as const).map((k) => (
            <label key={k}>
              <input
                type="checkbox"
                checked={s[k]}
                onChange={(e) =>
                  onChange(
                    stops.map((x, n) =>
                      n === i ? { ...x, [k]: e.target.checked } : x,
                    ),
                  )
                }
              />
              {k} allowed
            </label>
          ))}
          <button
            type="button"
            disabled={stops.length <= 2}
            onClick={() => onChange(stops.filter((_, n) => n !== i))}
          >
            Remove stop {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={stops.length >= 120}
        onClick={() =>
          onChange([
            ...stops,
            {
              stationId: "",
              arrivalMinutes: (stops.at(-1)?.departureMinutes ?? 0) + 60,
              departureMinutes: (stops.at(-1)?.departureMinutes ?? 0) + 60,
              boarding: false,
              alighting: true,
            },
          ])
        }
      >
        Add station call
      </button>
      <p>
        First arrival/departure offsets must be zero. Subsequent arrivals must
        follow the previous departure. Offsets can span multiple days.
      </p>
    </fieldset>
  );
}
const defaults: Record<Kind, Content> = {
  stations: { name: "", stationCode: "", city: "", active: true },
  routes: {
    name: "",
    active: true,
    stops: [
      {
        stationId: "",
        arrivalMinutes: 0,
        departureMinutes: 0,
        boarding: true,
        alighting: false,
      },
      {
        stationId: "",
        arrivalMinutes: 60,
        departureMinutes: 60,
        boarding: false,
        alighting: true,
      },
    ],
  },
  services: {
    name: "",
    trainNumber: "",
    routeId: "",
    departure: "",
    arrival: "",
    classes: [{ code: "", name: "" }],
    providerReference: "",
    operationalNotes: "",
  },
};
function Editor({
  kind,
  record,
  onSaved,
}: {
  kind: Kind;
  record?: TrainRecord;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<Content>(
      record?.content ?? defaults[kind],
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    request = useRef({ key: crypto.randomUUID(), body: "" });
  const station = content as Station,
    route = content as Route,
    service = content as Service;
  const change = (key: string, value: unknown) =>
    setContent((c) => ({ ...c, [key]: value }));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        let clean: Content = content;
        if (kind === "services") {
          const { routeSnapshot, ...s } = service;
          clean = s;
        } else if (kind === "routes") {
          clean = {
            ...route,
            stops: route.stops.map(({ station, ...s }) => s),
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
            `/admin/trains/${kind}${record ? "/" + record.id : ""}`,
            {
              method: record ? "PATCH" : "POST",
              headers: { "Idempotency-Key": request.current.key },
              body,
            },
          );
          if (record) onSaved();
          else location.assign(`/admin/trains?kind=${kind}&id=${result.id}`);
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
      {kind === "stations" && (
        <>
          {record ? (
            <p>Station code: {station.stationCode} (immutable)</p>
          ) : (
            <TextField
              label="Station code (uppercase)"
              value={station.stationCode}
              onChange={(v) => change("stationCode", v.toUpperCase())}
            />
          )}
          <TextField
            label="City"
            value={station.city}
            onChange={(v) => change("city", v)}
          />
        </>
      )}
      {kind === "routes" && (
        <Stops stops={route.stops} onChange={(v) => change("stops", v)} />
      )}{" "}
      {kind !== "services" && (
        <label>
          <input
            type="checkbox"
            checked={station.active}
            onChange={(e) => change("active", e.target.checked)}
          />
          Active local catalogue reference
        </label>
      )}
      {kind === "services" && (
        <>
          <TextField
            label="Train number"
            value={service.trainNumber}
            onChange={(v) => change("trainNumber", v)}
          />
          <Reference
            kind="routes"
            value={service.routeId}
            onChange={(v) => change("routeId", v)}
          />
          <TextField
            label="Departure (ISO timestamp with timezone)"
            value={service.departure}
            onChange={(v) => change("departure", v)}
          />
          <TextField
            label="Final arrival (ISO timestamp with timezone)"
            value={service.arrival}
            onChange={(v) => change("arrival", v)}
          />
          <p>
            Example: 2027-01-01T09:00:00+05:30. Final arrival must match the
            route's last arrival offset.
          </p>
          <fieldset>
            <legend>Travel classes (local reference)</legend>
            {service.classes.map((c, i) => (
              <div key={i}>
                <TextField
                  label="Class code"
                  value={c.code}
                  onChange={(v) =>
                    change(
                      "classes",
                      service.classes.map((x, n) =>
                        n === i ? { ...x, code: v.toUpperCase() } : x,
                      ),
                    )
                  }
                />
                <TextField
                  label="Class name"
                  value={c.name}
                  onChange={(v) =>
                    change(
                      "classes",
                      service.classes.map((x, n) =>
                        n === i ? { ...x, name: v } : x,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  disabled={service.classes.length <= 1}
                  onClick={() =>
                    change(
                      "classes",
                      service.classes.filter((_, n) => n !== i),
                    )
                  }
                >
                  Remove class
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={service.classes.length >= 30}
              onClick={() =>
                change("classes", [...service.classes, { code: "", name: "" }])
              }
            >
              Add travel class
            </button>
          </fieldset>
          <TextField
            label="Provider reference (metadata only; no credentials)"
            required={false}
            value={service.providerReference}
            onChange={(v) => change("providerReference", v)}
          />
          <label>
            Operational notes
            <textarea
              maxLength={3000}
              value={service.operationalNotes}
              onChange={(e) => change("operationalNotes", e.target.value)}
            />
          </label>
          <p>
            These notes are not supplier-enforced booking rules. Saving
            refreshes the route and station snapshots without changing external
            schedules or bookings.
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
function Incident({
  record,
  onSaved,
}: {
  record: TrainRecord;
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
          await api(`/admin/trains/services/${record.id}/incidents`, {
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
        before_data: TrainRecord | null;
        after_data: TrainRecord;
      }[];
      nextBefore: string | null;
    }>(
      `/admin/trains/${kind}/${id}/history${before ? "?before=" + before : ""}`,
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
function RouteView({ route: r }: { route: Route }) {
  return (
    <section>
      <h3>Station calls</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Arrival offset</th>
              <th>Departure offset</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {r.stops.map((s, i) => (
              <tr key={i}>
                <td>
                  {s.station?.name} ({s.station?.code}) · {s.station?.city}
                </td>
                <td>{s.arrivalMinutes} minutes</td>
                <td>{s.departureMinutes} minutes</td>
                <td>
                  {s.boarding ? "Boarding " : ""}
                  {s.alighting ? "Alighting" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function ServiceView({ service: s }: { service: Service }) {
  const time = (offset: number) =>
    new Date(Date.parse(s.departure) + offset * 60000).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
  return (
    <section>
      <h3>Train {s.trainNumber}</h3>
      <p>
        Departure {time(0)} IST · Final arrival{" "}
        {new Date(s.arrival).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })}{" "}
        IST
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Station</th>
              <th>Arrival (IST)</th>
              <th>Departure (IST)</th>
              <th>Passenger access</th>
            </tr>
          </thead>
          <tbody>
            {s.routeSnapshot?.stops.map((stop, i) => (
              <tr key={i}>
                <td>
                  {stop.station?.name} ({stop.station?.code}) ·{" "}
                  {stop.station?.city}
                </td>
                <td>{time(stop.arrivalMinutes)}</td>
                <td>{time(stop.departureMinutes)}</td>
                <td>
                  {stop.boarding ? "Boarding " : ""}
                  {stop.alighting ? "Alighting" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Travel classes</h3>
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Availability</th>
            <th>Fare</th>
          </tr>
        </thead>
        <tbody>
          {s.classes.map((c) => (
            <tr key={c.code}>
              <td>
                {c.code} · {c.name}
              </td>
              <td>Unknown — provider not connected</td>
              <td>Unavailable</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl>
        <dt>PNR / booking status</dt>
        <dd>Unavailable</dd>
        <dt>Confirmation / waitlist</dt>
        <dd>Unavailable</dd>
        <dt>Cancellation / provider refund status</dt>
        <dd>Unavailable</dd>
      </dl>
      <p>
        No supplier booking, payment or refund is represented by this catalogue
        record.
      </p>
      <p>Operational notes: {s.operationalNotes || "None"}</p>
    </section>
  );
}
export function AdminTrains() {
  const params = new URLSearchParams(location.search),
    kind = (
      ["stations", "routes", "services"].includes(params.get("kind") ?? "")
        ? params.get("kind")
        : "stations"
    ) as Kind,
    id = params.get("id"),
    grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    query = new URLSearchParams(params);
  query.delete("kind");
  query.delete("id");
  const { data, error } = useData<{
      items?: TrainRecord[];
      nextCursor?: string | null;
      record?: TrainRecord;
    }>(
      id
        ? `/admin/trains/${kind}/${encodeURIComponent(id)}`
        : `/admin/trains/${kind}?${query}`,
      revision,
    ),
    reload = () => setRevision((n) => n + 1);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Train management</h1>
      <nav aria-label="Train catalogue">
        {(["stations", "routes", "services"] as const).map((k) => (
          <a
            key={k}
            href={"/admin/trains?kind=" + k}
            aria-current={k === kind ? "page" : undefined}
          >
            {k}{" "}
          </a>
        ))}
      </nav>
      <p role="status">
        Supplier integration is not configured. This workspace manages reference
        catalogue data and local incidents. Live fares, availability, PNRs and
        refunds require an authorized railway provider.
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
              ["trainNumber", "routeId", "from", "until"].map((k) => (
                <label key={k}>
                  {k}{" "}
                  {k === "from" || k === "until"
                    ? "(departure ISO timestamp with timezone)"
                    : ""}
                  <input name={k} defaultValue={params.get(k) ?? ""} />
                </label>
              ))}
            <button>Search</button>
            <a href={"/admin/trains?kind=" + kind}>Clear</a>
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
                          <a href={`/admin/trains?kind=${kind}&id=${r.id}`}>
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
                <a href={adminPageLink("/admin/trains", location.search)}>
                  First page
                </a>
              )}{" "}
              {data.nextCursor && (
                <a
                  href={adminPageLink(
                    "/admin/trains",
                    location.search,
                    data.nextCursor,
                  )}
                >
                  Next page
                </a>
              )}
            </>
          )}
          {grants.includes("trains.manage") &&
            grants.includes("trains.read") && (
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
          ) : kind === "routes" ? (
            <RouteView route={data.record.content as Route} />
          ) : (
            <dl>
              <dt>Station code</dt>
              <dd>{(data.record.content as Station).stationCode}</dd>
              <dt>City</dt>
              <dd>{(data.record.content as Station).city}</dd>
            </dl>
          )}
          {grants.includes("trains.manage") && (
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
                <Incident
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
