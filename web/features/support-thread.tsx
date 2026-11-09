import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
type ThreadPage = {
  id: string;
  messages: {
    id: string;
    audience: "customer" | "internal";
    body: string;
    created_at: string;
  }[];
  nextMessageCursor: string | null;
};
export function SupportThread({
  initial,
  disabled,
}: {
  initial: ThreadPage;
  disabled: boolean;
}) {
  const [page, setPage] = useState<ThreadPage | null>(initial);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function load(nextPages: string[]) {
    if (loading || disabled) return;
    const current = ++request.current;
    setLoading(true);
    setError("");
    setPage(null);
    const after = nextPages.at(-1);
    try {
      const result = await api(
        `/operations/cases/${initial.id}${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      );
      if (current === request.current) {
        setPage(result);
        setPages(nextPages);
      }
    } catch (e) {
      if (current === request.current) setError((e as Error).message);
    } finally {
      if (current === request.current) setLoading(false);
    }
  }
  return (
    <section aria-label="Staff conversation">
      <p>
        Up to 50 messages per page, oldest to newest. Reading pages does not
        change the case version used by your unsent edits.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Loading conversation…</p>}
      {page?.messages.map((message) => (
        <article className="organization" key={message.id}>
          <strong>
            {message.audience === "internal"
              ? "Internal note — staff only"
              : "Customer-visible message"}
          </strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
          <time dateTime={message.created_at}>
            {new Date(message.created_at).toLocaleString("en-IN")}
          </time>
        </article>
      ))}
      {page?.messages.length === 0 && <p>No messages on this page.</p>}
      <nav className="chips" aria-label="Staff conversation pages">
        <button disabled={disabled || loading} onClick={() => void load([])}>
          Latest messages
        </button>
        <button
          disabled={disabled || loading || !pages.length}
          onClick={() => void load(pages.slice(0, -1))}
        >
          Newer messages
        </button>
        <span role="status">
          {pages.length
            ? `Older messages: page ${pages.length + 1}`
            : "Latest messages"}
        </span>
        <button
          disabled={disabled || loading || !page?.nextMessageCursor}
          onClick={() => {
            if (page?.nextMessageCursor)
              void load([...pages, page.nextMessageCursor]);
          }}
        >
          Older messages
        </button>
        <button disabled={disabled || loading} onClick={() => void load(pages)}>
          Refresh messages
        </button>
      </nav>
    </section>
  );
}
