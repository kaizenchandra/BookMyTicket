import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { HelpHistoryPage } from "../../src/modules/catalog/adapters/help-schema.ts";
export function HelpHistoryEntries({ items }: Pick<HelpHistoryPage, "items">) {
  return items.length ? (
    <>
      {items.map((item) => (
        <article key={item.inputVersion}>
          <h3>
            Edit from version {item.inputVersion} to {item.version}
          </h3>
          <p>
            Recorded{" "}
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              })}{" "}
              (India time)
            </time>
          </p>
          <p>Staff reference: {item.actorId}</p>
          <p>Reason: {item.reason}</p>
          <details>
            <summary>Content before this edit</summary>
            <p>
              {item.before.published ? "Published" : "Unpublished"} ·{" "}
              {item.before.topic}
            </p>
            <h4>{item.before.question}</h4>
            <p>{item.before.answer}</p>
          </details>
        </article>
      ))}
    </>
  ) : (
    <p>No recorded edits on this page.</p>
  );
}
export function HelpHistory({ id }: { id: string }) {
  const [requested, setRequested] = useState(false),
    [cursor, setCursor] = useState<number | null>(null),
    [page, setPage] = useState<HelpHistoryPage | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!requested) return;
    let active = true;
    setPage(null);
    setError("");
    api<HelpHistoryPage>(
      `/admin/help/${encodeURIComponent(id)}/history${cursor ? `?beforeVersion=${cursor}` : ""}`,
    )
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, requested, cursor, revision]);
  return (
    <section aria-label="Help article history">
      <h2>Article history</h2>
      <p>
        Recorded edits show content before each change. They do not represent
        the current answer. Loading history keeps your draft.
      </p>
      {!requested ? (
        <button onClick={() => setRequested(true)}>Load article history</button>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRevision((v) => v + 1)}>
            Retry history
          </button>
        </>
      ) : !page ? (
        <p role="status">Loading history…</p>
      ) : (
        <>
          <HelpHistoryEntries items={page.items} />
          <nav aria-label="Article history pages">
            <button
              onClick={() => {
                setCursor(null);
                setRevision((v) => v + 1);
              }}
            >
              Newest edits
            </button>
            {page.nextCursor !== null && (
              <button onClick={() => setCursor(page.nextCursor)}>
                Older edits
              </button>
            )}
          </nav>
        </>
      )}
    </section>
  );
}
