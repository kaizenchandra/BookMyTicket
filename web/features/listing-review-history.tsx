import { ListingRevisionHistory } from "./listing-revision-history.tsx";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
type Decision = {
  version: number;
  inputVersion: number;
  decision: string;
  reason: string;
  createdAt: string;
  reviewerId?: string;
};
export function ListingReviewHistory({
  listing,
  reviewer = false,
}: {
  listing: string;
  reviewer?: boolean;
}) {
  const [opened, setOpened] = useState(false),
    [page, setPage] = useState<{
      items: Decision[];
      nextCursor: number | null;
    } | null>(null),
    [before, setBefore] = useState<number | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const clear = () => {
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
    api<{ items: Decision[]; nextCursor: number | null }>(
      `${reviewer ? "/admin/listings" : "/listings"}/${encodeURIComponent(listing)}/reviews${before ? `?beforeVersion=${before}` : ""}`,
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
    <section aria-label="Listing review history">
      <h3>Review decision history</h3>
      <p>
        Historical decisions do not replace the current listing status. Only
        decisions recorded since durable listing decisions were introduced
        appear here. Older moderation records and draft edits are not included.
      </p>
      <button
        disabled={loading}
        onClick={() => {
          setOpened(true);
          setBefore(null);
          setRevision((r) => r + 1);
        }}
      >
        {opened ? "Refresh latest decisions" : "Load review history"}
      </button>
      {loading && <p role="status">Loading review history…</p>}
      {error && <p role="alert">{error}</p>}
      {page && !page.items.length && <p>No recorded decisions on this page.</p>}
      {page?.items.map((item) => (
        <article key={item.version} className="organization">
          <h4>{item.decision.replaceAll("_", " ")}</h4>
          <p>
            Reviewed version {item.inputVersion} · resulting version{" "}
            {item.version}
          </p>
          <time dateTime={item.createdAt}>
            {new Date(item.createdAt).toLocaleString("en-IN")}
          </time>
          <p style={{ whiteSpace: "pre-wrap" }}>{item.reason}</p>
          {item.reviewerId && <p>Reviewer reference: {item.reviewerId}</p>}
        </article>
      ))}
      <nav aria-label="Review history pages">
        {before && (
          <button disabled={loading} onClick={() => setBefore(null)}>
            Latest decisions
          </button>
        )}
        {page?.nextCursor && !error && (
          <button disabled={loading} onClick={() => setBefore(page.nextCursor)}>
            Older decisions
          </button>
        )}
      </nav>
    </section>
  );
}
export function ListingReviewHistoryPage({
  reviewer = false,
}: {
  reviewer?: boolean;
}) {
  const params = new URLSearchParams(location.search),
    listing = params.get("listingId") ?? "";
  return (
    <section className="reading">
      <h1>Listing review history</h1>
      <a href={reviewer ? "/admin/listings" : "/partner/venues"}>
        {reviewer ? "Back to listing reviews" : "Back to provider workspace"}
      </a>
      <form>
        <label>
          Listing reference
          <input
            name="listingId"
            defaultValue={listing}
            required
            pattern="[0-9a-fA-F-]{36}"
          />
        </label>
        <button>Open listing</button>
      </form>
      {listing && (
        <div key={listing}>
          <ListingReviewHistory listing={listing} reviewer={reviewer} />
          <ListingRevisionHistory listing={listing} reviewer={reviewer} />
        </div>
      )}
    </section>
  );
}
