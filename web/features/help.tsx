import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { HelpPage } from "../../src/modules/catalog/adapters/help-schema.ts";
export function HelpResults({ items }: Pick<HelpPage, "items">) {
  return items.length ? (
    <>
      <p role="status">{items.length} answers on this page.</p>
      {items.map((article) => (
        <article key={article.id} id={article.id}>
          <h2>{article.question}</h2>
          <p>{article.answer}</p>
          <a href={article.href}>{article.action}</a>
        </article>
      ))}
    </>
  ) : (
    <p role="status">
      No answers match on this page. Return to the first page, try fewer words
      or choose All topics.
    </p>
  );
}
export function HelpCenter() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q") ?? "",
    topic = params.get("topic") ?? "",
    after = params.get("after") ?? "";
  const [page, setPage] = useState<HelpPage | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    const query = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(topic ? { topic } : {}),
      ...(after ? { after } : {}),
    });
    api<HelpPage>(`/help?${query}`)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [q, topic, after, revision]);
  return (
    <section className="reading">
      <p className="eyebrow">HELP & ACCESSIBILITY</p>
      <h1>How can we help?</h1>
      <form action="/help" method="get">
        <label>
          Search help
          <input
            name="q"
            type="search"
            maxLength={100}
            defaultValue={q}
            placeholder="For example: payment pending"
          />
        </label>
        <label>
          Topic
          <select name="topic" defaultValue={topic}>
            <option value="">All topics</option>
            <option value="booking">Bookings and tickets</option>
            <option value="payment">Payments and refunds</option>
            <option value="account">Account</option>
            <option value="accessibility">Accessibility</option>
          </select>
        </label>
        <button>Search help</button> <a href="/help">Clear filters</a>
      </form>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRevision((v) => v + 1)}>Retry help</button>
        </>
      ) : page ? (
        <>
          <HelpResults items={page.items} />
          <HelpNavigation
            q={q}
            topic={topic}
            after={after}
            nextCursor={page.nextCursor}
          />
        </>
      ) : (
        <p role="status">Loading help…</p>
      )}
      <h2>Need more help?</h2>
      <a className="primary" href="/cases">
        Contact support
      </a>
      <p>
        Do not include OTPs or payment secrets in support messages. No response
        estimate is configured.
      </p>
    </section>
  );
}

export function HelpNavigation({
  q,
  topic,
  after,
  nextCursor,
}: {
  q: string;
  topic: string;
  after: string;
  nextCursor: string | null;
}) {
  const link = (cursor?: string) =>
    "/help?" +
    new URLSearchParams({
      ...(q ? { q } : {}),
      ...(topic ? { topic } : {}),
      ...(cursor ? { after: cursor } : {}),
    });
  return (
    <nav aria-label="Help result pages">
      {after && <a href={link()}>First page</a>}
      {nextCursor && <a href={link(nextCursor)}>Next answers</a>}
    </nav>
  );
}
