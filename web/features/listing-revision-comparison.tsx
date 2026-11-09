import { revisionFieldLabel } from "./revision-field-labels.ts";
import { useEffect, useState } from "react";
import { api } from "../api.ts";
export type RevisionComparison = {
  from: { id: string; version: number };
  to: { id: string; version: number };
  changes: { field: string; before: string | null; after: string | null }[];
};
export function RevisionComparisonResult({
  result,
}: {
  result: RevisionComparison;
}) {
  return (
    <section aria-label="Revision comparison result">
      <p>
        From version {result.from.version} ({result.from.id}) to version{" "}
        {result.to.version} ({result.to.id}).
      </p>
      {!result.changes.length ? (
        <p>No differences in the compared fields.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Changed saved fields</caption>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">From snapshot</th>
                <th scope="col">To snapshot</th>
              </tr>
            </thead>
            <tbody>
              {result.changes.map((c) => (
                <tr key={c.field}>
                  <th scope="row">{revisionFieldLabel(c.field)}</th>
                  <td style={{ whiteSpace: "pre-wrap" }}>
                    {c.before === null
                      ? "Not recorded"
                      : c.before === ""
                        ? "Empty text"
                        : c.before}
                  </td>
                  <td style={{ whiteSpace: "pre-wrap" }}>
                    {c.after === null
                      ? "Not recorded"
                      : c.after === ""
                        ? "Empty text"
                        : c.after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
export function ListingRevisionComparison({
  listing,
  reviewer,
  fromId,
  toId,
  onFrom,
  onTo,
}: {
  listing: string;
  reviewer: boolean;
  fromId: string;
  toId: string;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
}) {
  const [request, setRequest] = useState<{
      fromId: string;
      toId: string;
    } | null>(null),
    [result, setResult] = useState<RevisionComparison | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    setLoading(false);
    if (!request || request.fromId !== fromId || request.toId !== toId) return;
    setLoading(true);
    api<RevisionComparison>(
      `${reviewer ? "/admin/listings" : "/listings"}/${encodeURIComponent(listing)}/revisions/compare?${new URLSearchParams(request)}`,
    )
      .then((r) => {
        if (active) setResult(r);
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
  }, [request, listing, reviewer, fromId, toId]);
  return (
    <section aria-label="Compare saved revisions">
      <h3>Compare saved revisions</h3>
      <p>
        Choose From and To on revision cards, including across pages, or enter
        their references. This compares core content and supported saved
        category details only. Both snapshots precede changes; this does not
        compare the current listing or restore content.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRequest({ fromId, toId });
        }}
      >
        <label>
          From revision
          <input
            value={fromId}
            onChange={(e) => onFrom(e.target.value)}
            required
            pattern="[1-9][0-9]{0,18}"
          />
        </label>
        <label>
          To revision
          <input
            value={toId}
            onChange={(e) => onTo(e.target.value)}
            required
            pattern="[1-9][0-9]{0,18}"
          />
        </label>
        <button disabled={loading || !fromId || !toId || fromId === toId}>
          Compare revisions
        </button>
      </form>
      {loading && <p role="status">Comparing revisions…</p>}
      {error && <p role="alert">{error}</p>}
      {result && result.from.id === fromId && result.to.id === toId && (
        <RevisionComparisonResult result={result} />
      )}
    </section>
  );
}
