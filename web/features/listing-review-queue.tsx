import { useEffect, useState } from "react";
import { api } from "../api.ts";
export type ListingReviewItem = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  city: string;
  kind: string;
  state: "submitted";
  version: number;
  createdAt: string;
};
type Cursor = { afterCreatedAt: string; afterId: string };
type Page = { items: ListingReviewItem[]; nextCursor: Cursor | null };
export function listingQueueSearch(search: string) {
  const incoming = new URLSearchParams(search),
    result = new URLSearchParams();
  for (const key of ["kind", "afterCreatedAt", "afterId"])
    if (incoming.has(key)) result.set(key, incoming.get(key)!);
  return result;
}
export function ListingQueueNavigation({
  kind,
  paged,
  next,
}: {
  kind: string;
  paged: boolean;
  next: Cursor | null;
}) {
  const first = new URLSearchParams();
  if (kind) first.set("kind", kind);
  const later = new URLSearchParams(first);
  if (next) {
    later.set("afterCreatedAt", next.afterCreatedAt);
    later.set("afterId", next.afterId);
  }
  return (
    <nav aria-label="Listing review pages">
      {paged && <a href={`/admin/listings?${first}`}>First listings</a>}
      {next && <a href={`/admin/listings?${later}`}>Next listings</a>}
    </nav>
  );
}
type ReviewAttempt = { version: number; state: string; reason: string };
export function ListingReviewCard({
  item,
  onSaved,
}: {
  item: ListingReviewItem;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState<ReviewAttempt | null>(null);
  async function save(payload: ReviewAttempt) {
    if (busy) return;
    setAttempt(payload);
    setBusy(true);
    setError("");
    try {
      await api(`/admin/listings/${item.id}/review`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAttempt(null);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="organization">
      <h2>{item.title}</h2>
      <a href={`/admin/listing-history?listingId=${item.id}`}>
        View decision history
      </a>
      <p>
        {item.kind} · {item.city} · version {item.version}
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>
      <p>Organization reference: {item.organizationId}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          const form = new FormData(e.currentTarget);
          await save({
            version: item.version,
            state: String(form.get("state") ?? ""),
            reason: String(form.get("reason") ?? "").trim(),
          });
        }}
      >
        <fieldset disabled={busy}>
          <legend>Review listing</legend>
          <label>
            Decision
            <select name="state" required defaultValue="">
              <option value="" disabled>
                Select a decision
              </option>
              <option value="published">Publish approved listing</option>
              <option value="changes_requested">Request changes</option>
            </select>
          </label>
          <label>
            Reason
            <textarea name="reason" required minLength={5} maxLength={2000} />
          </label>
          <button>{busy ? "Saving decision…" : "Save review decision"}</button>
        </fieldset>
      </form>
      {error && (
        <div>
          <p role="alert">{error}</p>
          <p>
            Retry the original decision if the response was lost. This preserves
            the original version, decision and reason even if you edited the
            form. A different recorded decision returns a conflict; refresh the
            queue to inspect current state.
          </p>
          {attempt && (
            <button disabled={busy} onClick={() => void save(attempt)}>
              Retry original decision
            </button>
          )}
        </div>
      )}
    </article>
  );
}
export function ListingReviewQueue() {
  const params = listingQueueSearch(location.search),
    path = `/admin/listings?${params}`;
  const [page, setPage] = useState<Page | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState("");
  useEffect(() => {
    const clear = () => {
      setPage(null);
      setMessage("");
      setRevision((r) => r + 1);
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  useEffect(() => {
    let active = true;
    setPage(null);
    setLoading(true);
    setError("");
    api<Page>(path)
      .then((p) => {
        if (active) setPage(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return (
    <section className="reading">
      <h1>Listing review queue</h1>
      <p>
        <a href="/admin/listing-history">Find past listing decisions</a>
      </p>
      <a href="/admin">Provider reviews and administration</a>
      <form action="/admin/listings" method="get">
        <label>
          Listing type
          <select name="kind" defaultValue={params.get("kind") ?? ""}>
            <option value="">All listing types</option>
            <option value="movie">Movies</option>
            <option value="event">Events</option>
            <option value="sports">Sports</option>
          </select>
        </label>
        <button>Filter listings</button>
      </form>
      <p>
        Oldest created listings first. This queue changes as listings are
        reviewed; return to the first page to check earlier listings resubmitted
        later.
      </p>
      <button disabled={loading} onClick={() => setRevision((r) => r + 1)}>
        Refresh current page
      </button>
      {message && <p role="status">{message}</p>}
      {loading ? (
        <p role="status">Loading listings…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          {!page?.items.length && <p>No submitted listings on this page.</p>}
          {page?.items.map((item) => (
            <ListingReviewCard
              key={`${item.id}:${item.version}`}
              item={item}
              onSaved={() => {
                setMessage("Review decision saved.");
                setRevision((r) => r + 1);
              }}
            />
          ))}
          <ListingQueueNavigation
            kind={params.get("kind") ?? ""}
            paged={params.has("afterId")}
            next={page?.nextCursor ?? null}
          />
        </>
      )}
    </section>
  );
}
