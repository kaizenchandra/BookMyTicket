import React, { useEffect, useState } from "react";
import { api, ApiError } from "../api.ts";
import { AdminNavigation, useAdminCapabilities } from "./admin-workspace.tsx";
import { adminPageLink } from "./admin-access-links.ts";
import type {
  Content,
  Action,
  State,
} from "../../src/modules/hotels/domain/property.ts";
function errorMessage(e: unknown) {
  if (e instanceof ApiError && e.fields?.length)
    return (
      e.message +
      " " +
      e.fields.map((f) => f.path.join(".") + ": " + f.message).join("; ")
    );
  return (e as Error).message;
}
type Property = {
  id: string;
  code: string;
  content: Content;
  state: State;
  version: number;
  completeness: { complete: boolean; missing: string[] };
};
const empty: Content = {
  name: "",
  kind: "hotel",
  description: "",
  city: "",
  address: "",
  latitude: null,
  longitude: null,
  contactEmail: "",
  contactPhone: "",
  supplier: { name: "", reference: "" },
  images: [],
  amenities: [],
  facilities: [],
  houseRules: "",
  checkIn: "",
  checkOut: "",
  cancellationPolicy: "",
};
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
        if (!c.signal.aborted) setError(errorMessage(e));
      });
    return () => c.abort();
  }, [path, revision]);
  return { data, error };
}
function PropertyEditor({
  property,
  onSaved,
}: {
  property?: Property;
  onSaved: () => void;
}) {
  const [content, setContent] = useState<Content>(property?.content ?? empty),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [request, setRequest] = useState({ key: crypto.randomUUID(), body: "" });
  function update<K extends keyof Content>(key: K, value: Content[K]) {
    setContent((c) => ({ ...c, [key]: value }));
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          body = JSON.stringify({
            content: {
              ...content,
              amenities: content.amenities.map((x) => x.trim()).filter(Boolean),
              facilities: content.facilities
                .map((x) => x.trim())
                .filter(Boolean),
            },
            reason: f.get("reason"),
            ...(property
              ? { expectedVersion: property.version }
              : { code: f.get("code") }),
          }),
          key =
            request.body && request.body !== body
              ? crypto.randomUUID()
              : request.key;
        setRequest({ key, body });
        setBusy(true);
        setError("");
        try {
          const result = await api<{ id: string }>(
            "/admin/hotels" + (property ? "/" + property.id : ""),
            {
              method: property ? "PATCH" : "POST",
              headers: { "Idempotency-Key": key },
              body,
            },
          );
          if (property) onSaved();
          else location.assign("/admin/hotels/" + result.id);
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{property ? "Edit property" : "Onboard property"}</h2>
      {!property && (
        <label>
          Unique property code
          <input
            name="code"
            required
            pattern="[a-z][a-z0-9_-]{1,59}"
            maxLength={60}
          />
        </label>
      )}
      <label>
        Property type
        <select
          value={content.kind}
          onChange={(e) => update("kind", e.target.value as Content["kind"])}
        >
          <option value="hotel">Hotel</option>
          <option value="homestay">Homestay</option>
        </select>
      </label>
      {(
        [
          "name",
          "city",
          "address",
          "contactEmail",
          "contactPhone",
          "checkIn",
          "checkOut",
        ] as const
      ).map((field) => (
        <label key={field}>
          {(
            {
              contactEmail: "Private contact email",
              contactPhone: "Private contact phone",
              checkIn: "Check-in time",
              checkOut: "Check-out time",
            } as Record<string, string>
          )[field] ?? field}
          <input
            type={
              field === "contactEmail"
                ? "email"
                : field === "checkIn" || field === "checkOut"
                  ? "time"
                  : "text"
            }
            maxLength={field === "address" ? 1000 : 300}
            value={content[field]}
            onChange={(e) => update(field, e.target.value)}
          />
        </label>
      ))}
      {(["latitude", "longitude"] as const).map((field) => (
        <label key={field}>
          {field}
          <input
            type="number"
            step="any"
            min={field === "latitude" ? -90 : -180}
            max={field === "latitude" ? 90 : 180}
            value={content[field] ?? ""}
            onChange={(e) =>
              update(
                field,
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </label>
      ))}
      {(["description", "houseRules", "cancellationPolicy"] as const).map(
        (field) => (
          <label key={field}>
            {field}
            <textarea
              maxLength={10000}
              value={content[field]}
              onChange={(e) => update(field, e.target.value)}
            />
          </label>
        ),
      )}
      <fieldset>
        <legend>Associated supplier / contracting party</legend>
        {(["name", "reference"] as const).map((field) => (
          <label key={field}>
            Supplier {field}
            <input
              maxLength={300}
              value={content.supplier[field]}
              onChange={(e) =>
                update("supplier", {
                  ...content.supplier,
                  [field]: e.target.value,
                })
              }
            />
          </label>
        ))}
      </fieldset>
      {(["amenities", "facilities"] as const).map((field) => (
        <label key={field}>
          {field} (one per line)
          <textarea
            value={content[field].join("\n")}
            onChange={(e) => update(field, e.target.value.split("\n"))}
          />
        </label>
      ))}
      <fieldset>
        <legend>Property images (HTTPS references)</legend>
        {content.images.map((img, i) => (
          <div key={i}>
            <label>
              Image URL
              <input
                type="url"
                required
                value={img.url}
                onChange={(e) =>
                  update(
                    "images",
                    content.images.map((x, n) =>
                      n === i ? { ...x, url: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Alt text
              <input
                required
                maxLength={300}
                value={img.alt}
                onChange={(e) =>
                  update(
                    "images",
                    content.images.map((x, n) =>
                      n === i ? { ...x, alt: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                update(
                  "images",
                  content.images.filter((_, n) => n !== i),
                )
              }
            >
              Remove image {i + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={content.images.length >= 30}
          onClick={() =>
            update("images", [...content.images, { url: "", alt: "" }])
          }
        >
          Add image
        </button>
      </fieldset>
      <label>
        Change reason
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <label>
        <input type="checkbox" required />I confirm these changes. Editing a
        published property removes it from public listings until reviewed again.
      </label>
      <button disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
      {error && <p role="alert">{error}</p>}
      <p>
        Drafts may be incomplete. Required publication fields are checked when
        submitting and approving.
      </p>
    </form>
  );
}
function History({ id, revision }: { id: string; revision: number }) {
  const [before, setBefore] = useState<number | undefined>(),
    { data, error } = useData<{
      items: {
        version: number;
        action: string;
        reason: string;
        created_at: string;
        snapshot: Property;
      }[];
      nextBefore: number | null;
    }>(
      `/admin/hotels/${id}/history${before ? "?before=" + before : ""}`,
      revision,
    );
  return (
    <section>
      <h2>Property & policy history</h2>
      {error && <p role="alert">{error}</p>}
      {data?.items.map((r) => (
        <details key={r.version}>
          <summary>
            Version {r.version} · {r.action} ·{" "}
            {new Date(r.created_at).toLocaleString()}
          </summary>
          <p>{r.reason}</p>
          <pre>{JSON.stringify(r.snapshot.content, null, 2)}</pre>
        </details>
      ))}
      <button disabled={!before} onClick={() => setBefore(undefined)}>
        Latest
      </button>{" "}
      <button
        disabled={!data?.nextBefore}
        onClick={() => setBefore(data!.nextBefore!)}
      >
        Older revisions
      </button>
    </section>
  );
}
function PropertyReview({
  p,
  grants,
  onSaved,
}: {
  p: Property;
  grants: string[];
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const actions: Action[] =
    p.state === "draft"
      ? ["submit"]
      : p.state === "pending_review"
        ? ["approve", "reject"]
        : p.state === "published"
          ? ["suspend", "delist"]
          : p.state === "suspended"
            ? ["reopen", "delist"]
            : ["reopen"];
  const available = actions.filter((a) =>
    grants.includes(a === "submit" ? "hotels.manage" : "hotels.review"),
  );
  return available.length ? (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          await api("/admin/hotels/" + p.id + "/actions", {
            method: "POST",
            body: JSON.stringify({
              action: f.get("action"),
              expectedVersion: p.version,
              reason: f.get("reason"),
            }),
          });
          onSaved();
        } catch (e) {
          setError(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Publication workflow</h2>
      <label>
        Action
        <select name="action">
          {available.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <label>
        Decision reason
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <label>
        <input type="checkbox" required />I confirm this listing-state change.
      </label>
      <button disabled={busy}>Apply decision</button>
      {error && <p role="alert">{error}</p>}
    </form>
  ) : null;
}
export function AdminHotels({ id }: { id?: string }) {
  const grants = useAdminCapabilities(),
    [revision, setRevision] = useState(0),
    { data, error } = useData<
      Property & { items: Property[]; nextCursor: string | null }
    >(id ? "/admin/hotels/" + id : "/admin/hotels" + location.search, revision),
    params = new URLSearchParams(location.search),
    reload = () => setRevision((n) => n + 1);
  return (
    <section className="admin-workspace">
      <AdminNavigation />
      <h1>Hotels & properties</h1>
      <p>
        Manage listing content and publication. Room inventory, rates and hotel
        checkout are not included. External supplier synchronization is not
        configured.
      </p>
      <a href="/hotels">View published properties</a>{" "}
      {id && <a href="/admin/hotels">Property directory</a>}{" "}
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
            {["q", "city", "south", "north", "west", "east"].map((n) => (
              <label key={n}>
                {n === "q" ? "Name or code" : n}
                <input name={n} defaultValue={params.get(n) ?? ""} />
              </label>
            ))}
            <p>For a map-area filter, supply all four bounding coordinates.</p>
            <label>
              Kind
              <select name="kind" defaultValue={params.get("kind") ?? ""}>
                <option value="">All</option>
                <option>hotel</option>
                <option>homestay</option>
              </select>
            </label>
            <label>
              Status
              <select name="state" defaultValue={params.get("state") ?? ""}>
                <option value="">All</option>
                {[
                  "draft",
                  "pending_review",
                  "published",
                  "suspended",
                  "delisted",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button>Filter</button>
            <a href="/admin/hotels">Clear</a>
          </form>
          {data?.items && (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Location</th>
                      <th>State</th>
                      <th>Completeness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <a href={"/admin/hotels/" + p.id}>
                            {p.content.name || p.code}
                          </a>
                          <br />
                          {p.content.kind}
                        </td>
                        <td>{p.content.city}</td>
                        <td>{p.state}</td>
                        <td>
                          {p.completeness.complete
                            ? "Ready for review"
                            : p.completeness.missing.join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.items.length && <p>No matching properties.</p>}
              {params.has("after") && (
                <a href={adminPageLink("/admin/hotels", location.search)}>
                  First page
                </a>
              )}{" "}
              {data.nextCursor && (
                <a
                  href={adminPageLink(
                    "/admin/hotels",
                    location.search,
                    data.nextCursor,
                  )}
                >
                  Next page
                </a>
              )}
            </>
          )}
          {grants.includes("hotels.manage") &&
            grants.includes("hotels.read") && (
              <PropertyEditor onSaved={reload} />
            )}
        </>
      )}
      {id && data && (
        <>
          <h2>{data.content.name || data.code}</h2>
              <a href={`/admin/hotels/${id}/inventory`}>Manage room inventory & rates</a>
          <p>
            {data.state} · Version {data.version}
          </p>
          <p>
            {data.completeness.complete
              ? "All required publication fields supplied."
              : "Missing: " + data.completeness.missing.join(", ")}
          </p>
          <PropertyView content={data.content} />
          <PropertyReview
            key={"review" + data.version}
            p={data}
            grants={grants}
            onSaved={reload}
          />
          {grants.includes("hotels.manage") &&
            ["draft", "published"].includes(data.state) && (
              <PropertyEditor
                key={data.version}
                property={data}
                onSaved={reload}
              />
            )}
          <History key={revision} id={id} revision={revision} />
        </>
      )}
    </section>
  );
}
function PropertyView({
  content: c,
}: {
  content: Omit<Content, "contactEmail" | "contactPhone" | "supplier">;
}) {
  return (
    <article>
      <p>{c.description}</p>
      <p>
        {c.address}, {c.city} · {c.latitude}, {c.longitude}
      </p>
      {c.images.map((image, i) => (
        <img
          key={i}
          src={image.url}
          alt={image.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{ maxWidth: 240, maxHeight: 180, objectFit: "cover" }}
        />
      ))}
      <p>Amenities: {c.amenities.join(", ")}</p>
      <p>Facilities: {c.facilities.join(", ")}</p>
      <p>
        Check-in {c.checkIn} · Check-out {c.checkOut}
      </p>
      <h3>House rules</h3>
      <p>{c.houseRules}</p>
      <h3>Cancellation policy</h3>
      <p>{c.cancellationPolicy}</p>
    </article>
  );
}
export function PublishedHotels() {
  const { data, error } = useData<{
      items: { id: string; content: Content }[];
      nextCursor: string | null;
    }>("/hotels" + location.search),
    params = new URLSearchParams(location.search);
  return (
    <section>
      <h1>Published hotels & homestays</h1>
      <p>
        Property information only. Room availability and booking are not yet
        supported.
      </p>
      <form method="get">
        <label>
          City
          <input name="city" defaultValue={params.get("city") ?? ""} />
        </label>
        <button>Search</button>
        <a href="/hotels">Clear</a>
      </form>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data?.items.map((p) => (
        <section key={p.id}>
          <h2>{p.content.name}</h2>
          <PropertyView content={p.content} />
        </section>
      ))}
      {data && !data.items.length && <p>No published properties found.</p>}
      {params.has("after") && (
        <a href={adminPageLink("/hotels", location.search)}>First page</a>
      )}{" "}
      {data?.nextCursor && (
        <a href={adminPageLink("/hotels", location.search, data.nextCursor)}>
          Next page
        </a>
      )}
    </section>
  );
}
