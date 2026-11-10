import React, { useEffect, useState, useRef } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import { dashboardMoney } from "./admin-money.ts";
import type { Definition } from "../../src/modules/packages/domain/package.ts";
import type { PackageRecord } from "../../src/modules/packages/application/administration.ts";
import type { PackageAllotment } from "../../src/modules/inventory/contracts/package-allotments.ts";
type Detail = PackageRecord & {
  completeness: { complete: boolean; missing: string[] };
  allotments: PackageAllotment[];
};
function message(e: unknown) {
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
        if (!c.signal.aborted) setError(message(e));
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function Form({
  title,
  path,
  method = "POST",
  body,
  children,
  saved,
  confirm = true,
}: {
  title: string;
  path: string;
  method?: string;
  body: (f: FormData) => unknown;
  children: React.ReactNode;
  saved: (result: any) => void;
  confirm?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    request = useRef({ key: crypto.randomUUID(), body: "" });
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const b = JSON.stringify(body(new FormData(e.currentTarget)));
        if (request.current.body && request.current.body !== b)
          request.current.key = crypto.randomUUID();
        request.current.body = b;
        setBusy(true);
        setError("");
        try {
          saved(
            await api(path, {
              method,
              headers: { "Idempotency-Key": request.current.key },
              body: b,
            }),
          );
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      {children}
      {confirm && (
        <>
          <label>
            Reason
            <textarea name="reason" required minLength={10} maxLength={1000} />
          </label>
          <label>
            <input type="checkbox" required />I confirm this change. Editing a
            published definition returns it to draft.
          </label>
        </>
      )}
      <button disabled={busy}>{busy ? "Working…" : title}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
type Column = { key: string; label: string; type?: string; options?: string[] };
function Rows<T extends object>({
  title,
  values,
  columns,
  blank,
  change,
  max,
}: {
  title: string;
  values: T[];
  columns: Column[];
  blank: () => T;
  change: (rows: T[]) => void;
  max: number;
}) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {values.map((row, i) => (
        <div key={i}>
          {columns.map((c) => (
            <label key={c.key}>
              {c.label}
              {c.options ? (
                <select
                  value={String((row as Record<string, unknown>)[c.key])}
                  onChange={(e) =>
                    change(
                      values.map((r, n) =>
                        n === i ? { ...r, [c.key]: e.target.value } : r,
                      ),
                    )
                  }
                >
                  {c.options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={c.type ?? "text"}
                  required
                  value={String((row as Record<string, unknown>)[c.key] ?? "")}
                  onChange={(e) =>
                    change(
                      values.map((r, n) =>
                        n === i
                          ? {
                              ...r,
                              [c.key]:
                                c.type === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            }
                          : r,
                      ),
                    )
                  }
                />
              )}
            </label>
          ))}
          <button
            type="button"
            onClick={() => change(values.filter((_, n) => n !== i))}
          >
            Remove {i + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={values.length >= max}
        onClick={() => change([...values, blank()])}
      >
        Add {title.toLowerCase()}
      </button>
    </fieldset>
  );
}
const initial: Definition = {
  name: "",
  description: "",
  destinations: [],
  itinerary: [],
  inclusions: [],
  exclusions: [],
  images: [],
  departures: [],
  maxAdults: 2,
  maxChildren: 2,
  maxGuests: 4,
  childMaxAge: 12,
  childPolicy: "",
  cancellationPolicy: "",
  components: [],
  addons: [],
  markupBps: 0,
  feePaise: "0",
};
function Editor({ p, reload }: { p?: Detail; reload: () => void }) {
  const [d, setD] = useState<Definition>(p?.content ?? initial),
    set = <K extends keyof Definition>(k: K, v: Definition[K]) =>
      setD((d) => ({ ...d, [k]: v }));
  return (
    <Form
      title={p ? "Save package draft" : "Create holiday package"}
      path={"/admin/packages" + (p ? "/" + p.id : "")}
      method={p ? "PATCH" : "POST"}
      saved={(r) =>
        p ? reload() : location.assign("/admin/packages?id=" + r.id)
      }
      body={(f) => ({
        content: {
          ...d,
          destinations: d.destinations.map((x) => x.trim()).filter(Boolean),
          inclusions: d.inclusions.map((x) => x.trim()).filter(Boolean),
          exclusions: d.exclusions.map((x) => x.trim()).filter(Boolean),
        },
        reason: f.get("reason"),
        ...(p ? { expectedVersion: p.version } : { code: f.get("code") }),
      })}
    >
      {!p && (
        <label>
          Stable package code
          <input name="code" required pattern="[a-z][a-z0-9_-]{1,59}" />
        </label>
      )}
      <label>
        Name
        <input
          required
          value={d.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </label>
      {(["description", "childPolicy", "cancellationPolicy"] as const).map(
        (k) => (
          <label key={k}>
            {k}
            <textarea
              maxLength={10000}
              value={d[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ),
      )}
      {(["destinations", "inclusions", "exclusions"] as const).map((k) => (
        <label key={k}>
          {k} (one per line)
          <textarea
            value={d[k].join("\n")}
            onChange={(e) => set(k, e.target.value.split("\n"))}
          />
        </label>
      ))}
      <Rows
        title="Itinerary days"
        max={60}
        values={d.itinerary}
        blank={() => ({
          day: d.itinerary.length + 1,
          title: "",
          description: "",
        })}
        change={(v) => set("itinerary", v)}
        columns={[
          { key: "day", label: "Day number", type: "number" },
          { key: "title", label: "Title" },
          { key: "description", label: "Description" },
        ]}
      />
      <Rows
        title="Images"
        max={30}
        values={d.images}
        blank={() => ({ url: "", alt: "" })}
        change={(v) => set("images", v)}
        columns={[
          { key: "url", label: "HTTPS image reference", type: "url" },
          { key: "alt", label: "Alt text" },
        ]}
      />
      <Rows
        title="Departures"
        max={100}
        values={d.departures}
        blank={() => ({ start: "", end: "" })}
        change={(v) => set("departures", v)}
        columns={[
          { key: "start", label: "Start date", type: "date" },
          { key: "end", label: "End date (inclusive)", type: "date" },
        ]}
      />
      {(
        [
          "maxAdults",
          "maxChildren",
          "maxGuests",
          "childMaxAge",
          "markupBps",
        ] as const
      ).map((k) => (
        <label key={k}>
          {k}
          <input
            type="number"
            required
            value={d[k]}
            onChange={(e) => set(k, Number(e.target.value))}
          />
        </label>
      ))}
      <label>
        Fixed package fee (INR paise)
        <input
          required
          value={d.feePaise}
          onChange={(e) => set("feePaise", e.target.value)}
        />
      </label>
      <p>
        Markup is basis points (100 = 1%) applied to component costs only. Price
        previews do not calculate additional taxes or create supplier quotes.
      </p>
      <Rows
        title="Components"
        max={30}
        values={d.components}
        blank={() => ({
          id: "",
          name: "",
          kind: "hotel" as const,
          supplierReference: "",
          adultPaise: "0",
          childPaise: "0",
          fixedPaise: "0",
        })}
        change={(v) => set("components", v)}
        columns={[
          { key: "id", label: "Stable component key (lowercase)" },
          { key: "name", label: "Component name" },
          {
            key: "kind",
            label: "Type",
            options: ["hotel", "transport", "activity", "other"],
          },
          {
            key: "supplierReference",
            label: "Contracted supplier reference (not credentials)",
          },
          { key: "adultPaise", label: "Cost per adult (paise)" },
          { key: "childPaise", label: "Cost per child (paise)" },
          { key: "fixedPaise", label: "Fixed group cost (paise)" },
        ]}
      />
      <Rows
        title="Add-ons"
        max={30}
        values={d.addons}
        blank={() => ({ id: "", name: "", pricePaise: "0", basis: "booking" as const })}
        change={(v) => set("addons", v)}
        columns={[
          { key: "id", label: "Stable add-on key (lowercase)" },
          { key: "name", label: "Add-on name" },
          { key: "pricePaise", label: "Price (paise)" },
          {
            key: "basis",
            label: "Charge basis",
            options: ["person", "booking"],
          },
        ]}
      />
    </Form>
  );
}
function View({
  d,
}: {
  d: Pick<
    Definition,
    | "name"
    | "description"
    | "destinations"
    | "itinerary"
    | "inclusions"
    | "exclusions"
    | "images"
    | "departures"
    | "childPolicy"
    | "cancellationPolicy"
  >;
}) {
  return (
    <article>
      <h2>{d.name}</h2>
      <p>{d.description}</p>
      <p>Destinations: {d.destinations.join(", ")}</p>
      {d.images.map((img, i) => (
        <img
          key={i}
          src={img.url}
          alt={img.alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          style={{ maxWidth: 240, maxHeight: 180, objectFit: "cover" }}
        />
      ))}
      <ol>
        {d.itinerary.map((day) => (
          <li key={day.day}>
            <h3>
              Day {day.day}: {day.title}
            </h3>
            <p>{day.description}</p>
          </li>
        ))}
      </ol>
      <h3>Included</h3>
      <ul>
        {d.inclusions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <h3>Excluded</h3>
      <ul>
        {d.exclusions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
      <p>
        Travel dates:{" "}
        {d.departures.map((x) => x.start + " → " + x.end).join("; ")}
      </p>
      <p>Children: {d.childPolicy}</p>
      <p>Cancellation rules: {d.cancellationPolicy}</p>
    </article>
  );
}
function Pricing({ p }: { p: Detail }) {
  const [quote, setQuote] = useState<any>(null);
  return (
    <Form
      title="Calculate price preview"
      path={`/admin/packages/${p.id}/preview`}
      confirm={false}
      saved={setQuote}
      body={(f) => ({
        departure: f.get("departure"),
        adults: Number(f.get("adults")),
        childAges: String(f.get("ages"))
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .map(Number),
        addonIds: f.getAll("addon"),
      })}
    >
      <label>
        Departure
        <select name="departure" required>
          {p.content.departures.map((d) => (
            <option key={d.start}>{d.start}</option>
          ))}
        </select>
      </label>
      <label>
        Adults
        <input
          name="adults"
          required
          type="number"
          min={1}
          max={p.content.maxAdults}
          defaultValue={1}
        />
      </label>
      <label>
        Child ages (comma-separated)
        <input name="ages" />
      </label>
      {p.content.addons.map((a) => (
        <label key={a.id}>
          <input type="checkbox" name="addon" value={a.id} />
          {a.name} · {dashboardMoney(a.pricePaise)} per {a.basis}
        </label>
      ))}
      {quote && (
        <section aria-live="polite">
          <p>
            Definition version {quote.definitionVersion} · Total preview{" "}
            {dashboardMoney(quote.totalPaise)}
          </p>
          <ul>
            {[...quote.components, ...quote.addons].map((c: any, i: number) => (
              <li key={i}>
                {c.name}: {dashboardMoney(c.amountPaise)}
              </li>
            ))}
          </ul>
          <p>
            Markup {dashboardMoney(quote.markupPaise)} · Fee{" "}
            {dashboardMoney(quote.feePaise)}
          </p>
          <p>
            Current planning limit:{" "}
            {quote.planningLimit ??
              "Not configured for this definition version"}{" "}
            · Party within plan:{" "}
            {quote.withinPlanningLimit === null
              ? "Unknown"
              : quote.withinPlanningLimit
                ? "Yes"
                : "No"}
          </p>
          <p>Not bookable. Supplier availability/confirmations are unknown.</p>
        </section>
      )}
    </Form>
  );
}
function Allotments({ p, reload }: { p: Detail; reload: () => void }) {
  const [departure, setDeparture] = useState(
      p.content.departures[0]?.start ?? "",
    ),
    existing = p.allotments.find((a) => a.departure === departure);
  if (!departure) return <p>Add departure dates before planning inventory.</p>;
  return (
    <section>
      <h3>Supplier-allotment planning</h3>
      <label>
        Departure
        <select
          value={departure}
          onChange={(e) => setDeparture(e.target.value)}
        >
          {p.content.departures.map((d) => (
            <option key={d.start}>{d.start}</option>
          ))}
        </select>
      </label>
      <p>
        Passenger-entitlement limits only. These do not reserve supplier
        rooms/seats or prove availability. Reconfirm allotments after any
        definition or publication version change.
      </p>
      <Form
        key={departure + ":" + (existing?.version ?? 0)}
        title="Save planning limits"
        path={`/admin/packages/${p.id}/allotments`}
        method="PUT"
        saved={reload}
        body={(f) => ({
          departure,
          expectedVersion: p.version,
          allotmentVersion: existing?.version ?? 0,
          capacity: Number(f.get("capacity")),
          components: p.content.components.map((c) => ({
            id: c.id,
            capacity: Number(f.get("component:" + c.id)),
          })),
          reason: f.get("reason"),
        })}
      >
        <label>
          Total passenger planning cap
          <input
            type="number"
            min={0}
            max={10000}
            name="capacity"
            required
            defaultValue={existing?.capacity ?? 0}
          />
        </label>
        {p.content.components.map((c) => (
          <label key={c.id}>
            {c.name} · {c.supplierReference}
            <input
              type="number"
              min={0}
              max={10000}
              name={"component:" + c.id}
              required
              defaultValue={
                existing?.components.find((x) => x.id === c.id)?.capacity ?? 0
              }
            />
          </label>
        ))}
        <p>
          {existing?.definitionVersion === p.version
            ? "Planning matches this version."
            : "No current-version plan."}
        </p>
      </Form>
    </section>
  );
}
function History({ id, revision }: { id: string; revision: number }) {
  const [before, setBefore] = useState<string>(),
    { data, error } = useData<{
      items: {
        id: string;
        action: string;
        reason: string;
        created_at: string;
        snapshot: unknown;
      }[];
      nextBefore: string | null;
    }>(
      `/admin/packages/${id}/history${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h2>Definition & allotment history</h2>
      {error && <p role="alert">{error}</p>}
      {data?.items.map((h) => (
        <details key={h.id}>
          <summary>
            {h.action} · {new Date(h.created_at).toLocaleString()}
          </summary>
          <p>{h.reason}</p>
          <pre>{JSON.stringify(h.snapshot, null, 2)}</pre>
        </details>
      ))}
      <button disabled={!before} onClick={() => setBefore(undefined)}>
        Latest
      </button>
      <button
        disabled={!data?.nextBefore}
        onClick={() => setBefore(data!.nextBefore!)}
      >
        Older
      </button>
    </section>
  );
}
export function AdminPackages() {
  const params = new URLSearchParams(location.search),
    id = params.get("id"),
    grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    query = new URLSearchParams(params);
  query.delete("id");
  const { data, error } = useData<
      Detail & { items: Detail[]; nextCursor: string | null }
    >(
      id
        ? "/admin/packages/" + encodeURIComponent(id)
        : "/admin/packages?" + query,
      revision,
    ),
    reload = () => setRevision((n) => n + 1);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Holiday package management</h1>
      <p>
        Supplier fulfillment is not configured. Publication and pricing previews
        do not create reservations, payments or confirmations.
      </p>
      <a href="/holidays">Published package information</a> ·{" "}
      <a href="/admin/packages">Package directory</a>{" "}
      <button onClick={reload}>Reload</button>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {!id && (
        <>
          <form method="get">
            <label>
              Name/code
              <input name="q" defaultValue={params.get("q") ?? ""} />
            </label>
            <label>
              Destination
              <input
                name="destination"
                defaultValue={params.get("destination") ?? ""}
              />
            </label>
            <label>
              Status
              <select name="state" defaultValue={params.get("state") ?? ""}>
                <option value="">All</option>
                <option>draft</option>
                <option>pending_review</option>
                <option>published</option>
              </select>
            </label>
            <button>Search</button>
            <a href="/admin/packages">Clear</a>
          </form>
          {data?.items && (
            <>
              <ul>
                {data.items.map((p) => (
                  <li key={p.id}>
                    <a href={"/admin/packages?id=" + p.id}>{p.content.name}</a>{" "}
                    · {p.state} ·{" "}
                    {p.completeness.complete
                      ? "Complete"
                      : p.completeness.missing.join(", ")}
                  </li>
                ))}
              </ul>
              {!data.items.length && <p>No matching packages.</p>}
              {params.has("after") && (
                <a href={adminPageLink("/admin/packages", location.search)}>
                  First page
                </a>
              )}{" "}
              {data.nextCursor && (
                <a
                  href={adminPageLink(
                    "/admin/packages",
                    location.search,
                    data.nextCursor,
                  )}
                >
                  Next page
                </a>
              )}
            </>
          )}
          {grants.includes("packages.manage") &&
            grants.includes("packages.read") && <Editor reload={reload} />}
        </>
      )}
      {id && data && (
        <>
          <p>
            {data.state} · Version {data.version} ·{" "}
            {data.completeness.complete
              ? "Complete"
              : "Missing: " + data.completeness.missing.join(", ")}
          </p>
          <View d={data.content} />
          {((data.state === "draft" && grants.includes("packages.manage")) ||
            (data.state !== "draft" && grants.includes("packages.review"))) && (
            <Form
              title="Apply publication decision"
              path={`/admin/packages/${id}/actions`}
              saved={reload}
              body={(f) => ({
                action: f.get("action"),
                expectedVersion: data.version,
                reason: f.get("reason"),
              })}
            >
              <select name="action" aria-label="Publication action">
                {(data.state === "draft"
                  ? ["submit"]
                  : data.state === "pending_review"
                    ? ["approve", "reject"]
                    : ["unpublish"]
                ).map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Form>
          )}
          {grants.includes("packages.manage") &&
            data.state !== "pending_review" && (
              <Editor key={data.version} p={data} reload={reload} />
            )}
          <Pricing key={"price" + data.version} p={data} />
          {grants.includes("packages.manage") && (
            <Allotments
              key={"allotment" + data.version}
              p={data}
              reload={reload}
            />
          )}
          <p>
            Component reservations / supplier confirmations: unavailable.
            Failure compensation requires connected supplier workflows.
          </p>
          <History key={revision} id={id} revision={revision} />
        </>
      )}
    </section>
  );
}
export function PublishedPackages() {
  const { data, error } = useData<{
      items: { id: string; content: Definition }[];
      nextCursor: string | null;
    }>("/holiday-packages" + location.search),
    params = new URLSearchParams(location.search);
  return (
    <section>
      <h1>Holiday packages</h1>
      <p>
        Information only. Supplier availability and booking are not yet
        supported.
      </p>
      <form method="get">
        <label>
          Destination
          <input
            name="destination"
            defaultValue={params.get("destination") ?? ""}
          />
        </label>
        <button>Search</button>
        <a href="/holidays">Clear</a>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data?.items.map((p) => (
        <View key={p.id} d={p.content} />
      ))}
      {data && !data.items.length && <p>No published packages.</p>}
      {params.has("after") && (
        <a href={adminPageLink("/holidays", location.search)}>First page</a>
      )}{" "}
      {data?.nextCursor && (
        <a href={adminPageLink("/holidays", location.search, data.nextCursor)}>
          Next page
        </a>
      )}
    </section>
  );
}
