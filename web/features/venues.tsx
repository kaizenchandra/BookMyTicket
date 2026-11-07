import { OnlineAccessEditor } from "./online-access.tsx";
import { CategoryEditor } from "./category-editor.tsx";
import { AttendeeExportPanel } from "./attendee-exports.tsx";
import { RegistrationEditor } from "./registration.tsx";
import { CatalogEditor } from "./catalog-editor.tsx";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type {
  Plan,
  PlanResource,
} from "../../src/modules/venues/domain/plan.ts";
type Venue = { id: string; name: string; time_zone: string };
type Space = {
  id: string;
  venue_id: string;
  name: string;
  version: number;
  physical_capacity: number;
  turnaround_minutes: number;
};
type PlanVersion = {
  id: string;
  space_id: string;
  version: number;
  label: string;
  configuration: Plan;
};
const emptyResource = (): PlanResource => ({
  id: "",
  label: "",
  kind: "seat",
  section: "",
  row: "",
  gate: "",
  capacity: 1,
  x: 0,
  y: 0,
  accessible: false,
});
export function PlanPreview({ plan }: { plan: Plan }) {
  return (
    <section aria-label="Seating plan preview">
      <p className="screen">{plan.orientation}</p>
      <svg
        viewBox="-5 -5 110 110"
        role="img"
        aria-label="Seating arrangement; resource details follow in the accessible list"
        className="plan-preview"
      >
        {plan.resources.map((r, i) => (
          <g key={i}>
            <rect
              x={r.x - 2}
              y={r.y - 2}
              width="4"
              height="4"
              rx={r.accessible ? 2 : 0}
              fill="currentColor"
            >
              <title>
                {r.section} {r.row} {r.label}
                {r.accessible ? " — accessible" : ""}
              </title>
            </rect>
            <text
              x={r.x}
              y={r.y + 5}
              textAnchor="middle"
              fontSize="2.8"
              fill="currentColor"
            >
              {r.label}
            </text>
          </g>
        ))}
      </svg>
      <ul>
        {plan.resources.map((r, i) => (
          <li key={i}>
            {r.section} · {r.row} {r.label} ·{" "}
            {r.kind === "seat" ? "1 seat" : `${r.capacity} places`}
            {r.gate ? ` · Gate ${r.gate}` : ""}
            {r.accessible ? " · Accessible" : ""}
            {r.companionOf ? ` · Companion to ${r.companionOf}` : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function VenueWorkspace() {
  const [orgs, setOrgs] = useState<any[]>([]),
    [org, setOrg] = useState(""),
    [message, setMessage] = useState(""),
    [unsaved, setUnsaved] = useState(false);
  useEffect(() => {
    let current = true;
    api<{ items: any[] }>("/organizations")
      .then((r) => {
        if (current) setOrgs(r.items);
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, []);
  return (
    <section>
      <p className="eyebrow">PARTNER OPERATIONS</p>
      <h1>Venues, seating and schedules</h1>
      <label htmlFor="venue-organization">Organization</label>
      <select
        id="venue-organization"
        value={org}
        onChange={(e) => {
          if (
            unsaved &&
            !window.confirm("Discard unsaved changes and switch organizations?")
          )
            return;
          setUnsaved(false);
          setOrg(e.target.value);
        }}
      >
        <option value="">Choose an organization</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name} · {o.role} · {o.state}
          </option>
        ))}
      </select>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {org && <Workspace key={org} org={org} onDirtyChange={setUnsaved} />}
    </section>
  );
}
function Workspace({
  org,
  onDirtyChange,
}: {
  org: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [data, setData] = useState<{
      venues: Venue[];
      spaces: Space[];
      plans: PlanVersion[];
    }>({ venues: [], spaces: [], plans: [] }),
    [listings, setListings] = useState<any[]>([]),
    [occurrences, setOccurrences] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [spaceId, setSpaceId] = useState(""),
    [editingVersion, setEditingVersion] = useState<number | null>(null),
    [planId, setPlanId] = useState(""),
    [frequency, setFrequency] = useState("single"),
    [seriesPreview, setSeriesPreview] = useState<{
      items: { startsAt: string; endsAt: string }[];
      timeZone: string;
    } | null>(null),
    [resources, setResources] = useState<PlanResource[]>([]),
    [orientation, setOrientation] = useState(""),
    [dirty, setDirty] = useState(false);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  const operation = useRef(crypto.randomUUID()),
    lastInput = useRef("");
  useEffect(() => {
    let current = true;
    setLoading(true);
    Promise.all([
      api<any>(`/organizations/${org}/venues`),
      api<any>(`/organizations/${org}/listings`),
      api<any>(`/organizations/${org}/occurrences`),
    ])
      .then(([v, l, o]) => {
        if (current) {
          setData(v);
          setListings(l.items);
          setOccurrences(o.items);
        }
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [org, revision]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const space = data.spaces.find((s) => s.id === spaceId),
    selectedPlan = data.plans.find((p) => p.id === planId),
    selectedSpace = data.spaces.find((s) => s.id === selectedPlan?.space_id),
    selectedVenue = data.venues.find((v) => v.id === selectedSpace?.venue_id);
  async function submit(
    path: string,
    input: unknown,
    headers?: Record<string, string>,
  ) {
    setBusy(true);
    setMessage("");
    try {
      await api(path, { method: "POST", headers, body: JSON.stringify(input) });
      setMessage("Saved. The displayed list will refresh from the server.");
      setDirty(false);
      setRevision((r) => r + 1);
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function field(r: number, name: keyof PlanResource, value: unknown) {
    setDirty(true);
    setResources((old) =>
      old.map((x, i) => (i === r ? { ...x, [name]: value } : x)),
    );
  }
  const text = (f: FormData, k: string) => String(f.get(k) ?? "");
  return (
    <div className="venue-workspace">
      {loading && <p role="status">Refreshing organization data…</p>}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <CategoryEditor
        key={org}
        org={org}
        onSaved={() => {
          setDirty(false);
          setRevision((r) => r + 1);
        }}
        onDirty={() => setDirty(true)}
      />
      <CatalogEditor
        org={org}
        listings={listings}
        onSaved={() => {
          setDirty(false);
          setRevision((r) => r + 1);
        }}
        onDirty={() => setDirty(true)}
      />
      <details open={!data.venues.length}>
        <summary>Create a venue</summary>
        <form
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            if (
              await submit(`/organizations/${org}/venues`, {
                name: text(f, "name"),
                address: text(f, "address"),
                city: text(f, "city"),
                timeZone: text(f, "timeZone"),
                amenities: text(f, "amenities"),
                accessibility: text(f, "accessibility"),
              })
            )
              form.reset();
          }}
        >
          {[
            ["name", "Venue name"],
            ["address", "Full address"],
            ["city", "City"],
            ["timeZone", "Venue time zone (for example Asia/Kolkata)"],
            ["amenities", "Amenities"],
            ["accessibility", "Accessibility information"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <input
                name={name}
                required={!["amenities", "accessibility"].includes(name)}
                defaultValue={name === "timeZone" ? "Asia/Kolkata" : ""}
                maxLength={name === "address" ? 1000 : 2000}
              />
            </label>
          ))}
          <button className="primary" disabled={busy}>
            Save venue
          </button>
        </form>
      </details>
      <details>
        <summary>Create a screen or other space</summary>
        <form
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            if (
              await submit(
                `/organizations/${org}/venues/${text(f, "venueId")}/spaces`,
                {
                  name: text(f, "name"),
                  kind: text(f, "kind"),
                  physicalCapacity: Number(f.get("capacity")),
                  turnaroundMinutes: Number(f.get("turnaround")),
                },
              )
            )
              form.reset();
          }}
        >
          <label>
            Venue
            <select name="venueId" required>
              <option value="">Choose venue</option>
              {data.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Space name
            <input name="name" maxLength={100} required />
          </label>
          <label>
            Space type
            <select name="kind">
              <option value="screen">Cinema screen</option>
              <option value="auditorium">Auditorium</option>
              <option value="stadium">Stadium</option>
              <option value="hall">Hall</option>
            </select>
          </label>
          <label>
            Physical capacity
            <input
              name="capacity"
              type="number"
              min={1}
              max={100000}
              required
            />
          </label>
          <label>
            Turnaround after each occurrence (minutes)
            <input
              name="turnaround"
              type="number"
              min={0}
              max={1440}
              required
            />
          </label>
          <button className="primary" disabled={busy}>
            Save space
          </button>
        </form>
      </details>
      <details>
        <summary>Create an immutable seating-plan version</summary>
        <p>
          A new version applies only to new occurrences. Existing bookings and
          schedules retain their original version.
        </p>
        <label>
          Space
          <select
            value={spaceId}
            onChange={(e) => {
              if (
                dirty &&
                !window.confirm(
                  "Discard unsaved form changes and choose another space?",
                )
              )
                return;
              setSpaceId(e.target.value);
              setEditingVersion(
                data.spaces.find((s) => s.id === e.target.value)?.version ??
                  null,
              );
              setResources([]);
              setOrientation("");
              setDirty(false);
            }}
          >
            <option value="">Choose space</option>
            {data.spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {data.venues.find((v) => v.id === s.venue_id)?.name} · {s.name}
              </option>
            ))}
          </select>
        </label>
        {space && (
          <>
            <p>
              Physical capacity {space.physical_capacity}. Current editing
              version {editingVersion}. Latest space version {space.version}.
            </p>
            <form
              onChange={() => setDirty(true)}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void submit(`/organizations/${org}/spaces/${space.id}/plans`, {
                  label: text(f, "label"),
                  expectedVersion: editingVersion,
                  configuration: {
                    orientation,
                    resources: resources.map((r) => ({
                      ...r,
                      ...(!r.companionOf ? { companionOf: undefined } : {}),
                    })),
                  },
                });
              }}
            >
              <label>
                Plan version label
                <input name="label" maxLength={100} required />
              </label>
              <label>
                Screen, stage or field orientation
                <input
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              {resources.map((r, i) => (
                <fieldset className="resource-editor" key={i}>
                  <legend>Resource {i + 1}</legend>
                  {(["id", "label", "section", "row", "gate"] as const).map(
                    (k) => (
                      <label key={k}>
                        {
                          {
                            id: "Stable resource ID",
                            label: "Seat or area label",
                            section: "Section / block",
                            row: "Row",
                            gate: "Gate",
                          }[k]
                        }
                        <input
                          value={r[k]}
                          required={["id", "label", "section"].includes(k)}
                          maxLength={100}
                          onChange={(e) => field(i, k, e.target.value)}
                        />
                      </label>
                    ),
                  )}
                  <label>
                    Type
                    <select
                      value={r.kind}
                      onChange={(e) => {
                        field(i, "kind", e.target.value);
                        if (e.target.value === "seat") field(i, "capacity", 1);
                      }}
                    >
                      <option value="seat">Assigned seat</option>
                      <option value="pool">General admission area</option>
                    </select>
                  </label>
                  <label>
                    Capacity
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={r.capacity}
                      disabled={r.kind === "seat"}
                      onChange={(e) =>
                        field(i, "capacity", Number(e.target.value))
                      }
                    />
                  </label>
                  {(["x", "y"] as const).map((k) => (
                    <label key={k}>
                      {k === "x" ? "Horizontal" : "Vertical"} position (0–100)
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={r[k]}
                        required
                        onChange={(e) => field(i, k, Number(e.target.value))}
                      />
                    </label>
                  ))}
                  <label>
                    <input
                      type="checkbox"
                      checked={r.accessible}
                      onChange={(e) => field(i, "accessible", e.target.checked)}
                    />
                    Accessible
                  </label>
                  <label>
                    Companion to resource ID (optional)
                    <input
                      value={r.companionOf ?? ""}
                      onChange={(e) => field(i, "companionOf", e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResources((old) => old.filter((_, n) => n !== i));
                      setDirty(true);
                    }}
                  >
                    Remove resource
                  </button>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={resources.length >= 1000}
                onClick={() => {
                  setResources((old) => [...old, emptyResource()]);
                  setDirty(true);
                }}
              >
                Add seat or admission area
              </button>
              <PlanPreview plan={{ orientation, resources }} />
              <button className="primary" disabled={busy || !resources.length}>
                Save new plan version
              </button>
            </form>
          </>
        )}
      </details>
      <details>
        <summary>Inspect saved plans</summary>
        {!data.plans.length ? (
          <p>No seating plans have been saved.</p>
        ) : (
          data.plans.map((p) => (
            <details key={p.id}>
              <summary>
                {data.spaces.find((s) => s.id === p.space_id)?.name} · {p.label}{" "}
                · version {p.version}
              </summary>
              <PlanPreview plan={p.configuration} />
              <button
                type="button"
                onClick={() => {
                  if (
                    dirty &&
                    !window.confirm(
                      "Replace unsaved plan changes with this saved version?",
                    )
                  )
                    return;
                  setSpaceId(p.space_id);
                  setEditingVersion(
                    data.spaces.find((s) => s.id === p.space_id)?.version ??
                      null,
                  );
                  setResources(
                    p.configuration.resources.map((r) => ({ ...r })),
                  );
                  setOrientation(p.configuration.orientation);
                  setDirty(true);
                  setMessage(
                    "Saved plan copied into the plan editor. Open Create an immutable seating-plan version to review and save it.",
                  );
                }}
              >
                Use as a new version draft
              </button>
            </details>
          ))
        )}
      </details>
      <details>
        <summary>Schedule an occurrence</summary>
        <p>
          Scheduling requires an approved organization and a published listing.
          Time inputs use the selected venue's local time; specify the correct
          UTC offset on that date.
        </p>
        <label>
          Seating plan
          <select
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setSeriesPreview(null);
            }}
          >
            <option value="">Choose a saved plan</option>
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {data.spaces.find((s) => s.id === p.space_id)?.name} · {p.label}{" "}
                · v{p.version}
              </option>
            ))}
          </select>
        </label>
        {selectedPlan && (
          <form
            key={planId}
            onChange={() => {
              setDirty(true);
              setSeriesPreview(null);
            }}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const prices: Record<string, number> = {};
              for (const r of selectedPlan.configuration.resources) {
                const raw = text(f, `price:${r.id}`);
                if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
                  setMessage(
                    "Enter prices in INR with up to two decimal places.",
                  );
                  return;
                }
                const [whole, fraction = ""] = raw.split(".");
                prices[r.id] =
                  Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
              }
              const input = {
                organizationId: org,
                listingId: text(f, "listingId"),
                planId,
                startsAt:
                  text(f, "startsAt") + ":00" + text(f, "startsAtOffset"),
                endsAt: text(f, "endsAt") + ":00" + text(f, "endsAtOffset"),
                salesOpen:
                  text(f, "salesOpen") + ":00" + text(f, "salesOpenOffset"),
                salesClose:
                  text(f, "salesClose") + ":00" + text(f, "salesCloseOffset"),
                prices,
              };
              const payload =
                frequency === "single"
                  ? input
                  : {
                      schedule: input,
                      repeat: {
                        frequency,
                        interval: Number(text(f, "repeatInterval")),
                        count: Number(text(f, "repeatCount")),
                        excludeDates: text(f, "excludedDates")
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      },
                    };
              const serialized = JSON.stringify(payload);
              if (lastInput.current !== serialized) {
                operation.current = crypto.randomUUID();
                lastInput.current = serialized;
              }
              if (frequency !== "single" && !seriesPreview) {
                setBusy(true);
                setMessage("");
                try {
                  setSeriesPreview(
                    await api("/occurrences/series/preview", {
                      method: "POST",
                      body: serialized,
                    }),
                  );
                } catch (error) {
                  setMessage((error as Error).message);
                } finally {
                  setBusy(false);
                }
                return;
              }
              const saved = await submit(
                frequency === "single" ? "/occurrences" : "/occurrences/series",
                payload,
                { "Idempotency-Key": operation.current },
              );
              if (saved) setSeriesPreview(null);
            }}
          >
            <fieldset disabled={busy} className="schedule-fields">
              <p>
                Venue timezone: {selectedVenue?.time_zone}. Turnaround:{" "}
                {selectedSpace?.turnaround_minutes} minutes.
              </p>
              <label>
                Published listing
                <select name="listingId" required>
                  <option value="">Choose listing</option>
                  {listings
                    .filter((l) => l.state === "published")
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                </select>
              </label>
              {[
                ["startsAt", "Starts"],
                ["endsAt", "Ends"],
                ["salesOpen", "Sales open"],
                ["salesClose", "Sales close"],
              ].map(([name, label]) => (
                <fieldset key={name}>
                  <legend>{label}</legend>
                  <label>
                    Venue-local date and time
                    <input name={name} type="datetime-local" required />
                  </label>
                  <label>
                    UTC offset on this date
                    <input
                      name={name + "Offset"}
                      defaultValue={
                        selectedVenue?.time_zone === "Asia/Kolkata"
                          ? "+05:30"
                          : ""
                      }
                      placeholder="+05:30"
                      pattern="[+-][0-9]{2}:[0-9]{2}"
                      required
                    />
                  </label>
                </fieldset>
              ))}
              {selectedPlan.configuration.resources.map((r) => (
                <label key={r.id}>
                  {r.section} · {r.label} price (INR)
                  <input
                    name={`price:${r.id}`}
                    inputMode="decimal"
                    required
                    pattern="[0-9]+([.][0-9]{1,2})?"
                  />
                </label>
              ))}
              <label>
                Schedule type
                <select
                  name="repeatFrequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                >
                  <option value="single">Single session</option>
                  <option value="daily">Daily series</option>
                  <option value="weekly">Weekly series</option>
                </select>
              </label>
              {frequency !== "single" && (
                <>
                  <label>
                    Repeat every (days or weeks)
                    <input
                      name="repeatInterval"
                      type="number"
                      min={1}
                      max={12}
                      defaultValue={1}
                      required
                    />
                  </label>
                  <label>
                    Number of dates before exclusions
                    <input
                      name="repeatCount"
                      type="number"
                      min={2}
                      max={24}
                      defaultValue={4}
                      required
                    />
                  </label>
                  <label>
                    Excluded start dates (YYYY-MM-DD, separated by commas)
                    <input
                      name="excludedDates"
                      placeholder="2026-12-25, 2027-01-01"
                    />
                  </label>
                  <p>
                    Sales open at the same configured instant for all sessions.
                    Start, end and sales-close dates repeat. Every offset is
                    checked against the venue's time zone when published; split
                    a series at daylight-saving changes.
                  </p>
                  {seriesPreview && (
                    <section aria-label="Series preview">
                      <h3>Review {seriesPreview.items.length} sessions</h3>
                      <p>
                        Preview only. Conflicts and permissions are checked
                        again when publishing. If any session conflicts, none
                        are created.
                      </p>
                      <ol>
                        {seriesPreview.items.map((item) => (
                          <li key={item.startsAt}>
                            {new Date(item.startsAt).toLocaleString("en-IN", {
                              timeZone: seriesPreview.timeZone,
                            })}{" "}
                            –{" "}
                            {new Date(item.endsAt).toLocaleString("en-IN", {
                              timeZone: seriesPreview.timeZone,
                            })}{" "}
                            · {seriesPreview.timeZone}
                          </li>
                        ))}
                      </ol>
                      <p>
                        Pricing policies and attendee forms must be configured
                        for each created session before booking is available.
                      </p>
                    </section>
                  )}
                </>
              )}
              <button className="primary" disabled={busy}>
                {busy
                  ? "Saving…"
                  : frequency === "single"
                    ? "Create occurrence"
                    : seriesPreview
                      ? `Publish ${seriesPreview.items.length} sessions`
                      : "Preview recurring sessions"}
              </button>
            </fieldset>
          </form>
        )}
      </details>
      <h2>Scheduled occurrences</h2>
      {!occurrences.length ? (
        <p>No occurrences have been scheduled.</p>
      ) : (
        occurrences.map((o) => (
          <article className="organization" key={o.id}>
            <h3>{o.venue_name}</h3>
            <p>
              {new Date(o.starts_at).toLocaleString("en-IN", {
                timeZone: o.time_zone,
              })}{" "}
              · {o.time_zone} · {o.state}
            </p>
            <RegistrationEditor occurrenceId={o.id} />
            <OnlineAccessEditor occurrenceId={o.id} />
            <AttendeeExportPanel occurrenceId={o.id} />
            <a href={`/occurrence/${o.id}`}>View customer seating</a>
          </article>
        ))
      )}
      <button
        disabled={busy || loading}
        onClick={() => setRevision((r) => r + 1)}
      >
        Refresh organization data
      </button>
    </div>
  );
}
