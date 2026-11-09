import { revisionFieldLabel } from "./revision-field-labels.ts";
import { ListingRevisionComparison } from "./listing-revision-comparison.tsx";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
export type ListingRevision = {
  id: string;
  version: number;
  reason: string | null;
  createdAt: string;
  actorId?: string | null;
  snapshot: {
    title: string | null;
    description: string | null;
    city: string | null;
    kind: string | null;
    state: string | null;
    categoryDetails?: Record<string, string | null>;
  };
};
export function ListingRevisionCard({
  item,
  onFrom,
  onTo,
}: {
  item: ListingRevision;
  onFrom?: (id: string) => void;
  onTo?: (id: string) => void;
}) {
  return (
    <article className="organization">
      <h4>Before change · version {item.version}</h4>
      <p>Revision reference: {item.id}</p>
      {onFrom && (
        <button onClick={() => onFrom(item.id)}>Use as From revision</button>
      )}
      {onTo && (
        <button onClick={() => onTo(item.id)}>Use as To revision</button>
      )}
      <time dateTime={item.createdAt}>
        {new Date(item.createdAt).toLocaleString("en-IN")}
      </time>
      <h5>{item.snapshot.title ?? "Title unavailable"}</h5>
      <p>
        {item.snapshot.kind ?? "Kind unavailable"} ·{" "}
        {item.snapshot.city ?? "City unavailable"} · saved state:{" "}
        {item.snapshot.state ?? "Unavailable"}
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {item.snapshot.description ?? "Description unavailable"}
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {item.reason === null
          ? "No reason was recorded for this revision."
          : `Recorded reason: ${item.reason}`}
      </p>
      {Object.keys(item.snapshot.categoryDetails ?? {}).length > 0 && (
        <section aria-label="Saved category details">
          <h5>Saved category details</h5>
          <dl>
            {Object.entries(item.snapshot.categoryDetails ?? {}).map(
              ([field, value]) => (
                <div key={field}>
                  <dt>{revisionFieldLabel(field)}</dt>
                  <dd style={{ whiteSpace: "pre-wrap" }}>
                    {value === null
                      ? "Not recorded"
                      : value === ""
                        ? "Empty text"
                        : value}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
      )}
      {item.actorId !== undefined && (
        <p>Actor reference: {item.actorId ?? "Not recorded"}</p>
      )}
    </article>
  );
}
export function ListingRevisionHistory({
  listing,
  reviewer = false,
}: {
  listing: string;
  reviewer?: boolean;
}) {
  const [opened, setOpened] = useState(false),
    [page, setPage] = useState<{
      items: ListingRevision[];
      nextCursor: string | null;
    } | null>(null),
    [before, setBefore] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [fromId, setFromId] = useState(""),
    [toId, setToId] = useState("");
  useEffect(() => {
    const clear = () => {
      setFromId("");
      setToId("");
      setPage(null);
      setOpened(false);
      setBefore(null);
      setError("");
    };
    window.addEventListener("bmt-session", clear);
    return () => window.removeEventListener("bmt-session", clear);
  }, []);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    if (!opened) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api<{ items: ListingRevision[]; nextCursor: string | null }>(
      `${reviewer ? "/admin/listings" : "/listings"}/${encodeURIComponent(listing)}/revisions${before ? `?beforeId=${before}` : ""}`,
    )
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
  }, [listing, reviewer, opened, before, revision]);
  return (
    <section aria-label="Listing saved revision history">
      <h3>Saved revision history</h3>
      <p>
        These are retained snapshots from before an edit, submission or review.
        They are not the current listing or proof of a later decision. Core
        content and supported saved category details are shown. Unrelated
        metadata and fields not retained in listing snapshots are excluded.
        Missing historical actors and reasons are not reconstructed. Expanded
        category details are retained on future saves; older snapshots may show
        Not recorded.
      </p>
      <button
        disabled={loading}
        onClick={() => {
          setOpened(true);
          setBefore(null);
          setRevision((r) => r + 1);
        }}
      >
        {opened ? "Refresh latest revisions" : "Load saved revisions"}
      </button>
      {loading && <p role="status">Loading saved revisions…</p>}
      {error && <p role="alert">{error}</p>}
      {page && !page.items.length && <p>No saved revisions on this page.</p>}
      {page?.items.map((item) => (
        <ListingRevisionCard
          key={item.id}
          item={item}
          onFrom={setFromId}
          onTo={setToId}
        />
      ))}
      <nav aria-label="Revision history pages">
        {before && (
          <button disabled={loading} onClick={() => setBefore(null)}>
            Latest revisions
          </button>
        )}
        {page?.nextCursor && !error && (
          <button disabled={loading} onClick={() => setBefore(page.nextCursor)}>
            Older revisions
          </button>
        )}
      </nav>
      <ListingRevisionComparison
        listing={listing}
        reviewer={reviewer}
        fromId={fromId}
        toId={toId}
        onFrom={setFromId}
        onTo={setToId}
      />
    </section>
  );
}
