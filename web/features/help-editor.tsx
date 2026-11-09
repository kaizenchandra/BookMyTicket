import { HelpCreationForm } from "./help-creation.tsx";
import { HelpHistory } from "./help-history.tsx";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type { HelpEditorPage } from "../../src/modules/catalog/adapters/help-schema.ts";
import type { HelpEdit } from "../../src/modules/catalog/application/help.ts";
import { HelpResults } from "./help.tsx";
type Article = HelpEditorPage["items"][number];
export function HelpArticleEditor({
  article,
  reload,
}: {
  article: Article;
  reload: () => void;
}) {
  const [question, setQuestion] = useState(article.question),
    [answer, setAnswer] = useState(article.answer),
    [topic, setTopic] = useState(article.topic),
    [published, setPublished] = useState(article.published),
    [reason, setReason] = useState(""),
    [attempt, setAttempt] = useState<HelpEdit | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function save(input: HelpEdit) {
    setAttempt(input);
    setBusy(true);
    setError("");
    try {
      await api(`/admin/help/${article.id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      if (active.current) reload();
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Edit help article">
      <p>
        Article {article.id}, version {article.version}. Saving a published
        article makes its changes public immediately.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!attempt)
            void save({
              question,
              answer,
              topic,
              published,
              reason,
              version: article.version,
            });
        }}
      >
        <fieldset disabled={busy || attempt !== null}>
          <legend>Article content</legend>
          <label>
            Question
            <input
              required
              maxLength={200}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label>
            Answer
            <textarea
              required
              maxLength={4000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          <label>
            Topic
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value as Article["topic"])}
            >
              <option value="booking">Booking</option>
              <option value="payment">Payment</option>
              <option value="account">Account</option>
              <option value="accessibility">Accessibility</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            Published in public Help
          </label>
          <label>
            Reason for change
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button>Save content and publication state</button>
        </fieldset>
      </form>
      <HelpHistory key={article.id} id={article.id} />
      <h2>Preview</h2>
      <p>
        {published
          ? "This content will be public after saving."
          : "This article will be hidden from public Help after saving."}
      </p>
      <HelpResults items={[{ ...article, question, answer, topic }]} />
      {error && <p role="alert">{error}</p>}
      {attempt && (
        <>
          <p>
            Your original save is retained. Retry it to recover an uncertain
            result. Loading the latest article discards this draft.
          </p>
          <button disabled={busy} onClick={() => void save(attempt)}>
            Retry original save
          </button>
        </>
      )}
      <button disabled={busy} onClick={reload}>
        Discard draft and load latest articles
      </button>
    </section>
  );
}
export function HelpAdministration() {
  const [page, setPage] = useState<HelpEditorPage | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState(""),
    [creating, setCreating] = useState(false),
    [filters, setFilters] = useState({ q: "", status: "all" }),
    [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setPage(null);
    setError("");
    const params = new URLSearchParams({
      ...filters,
      ...(cursor ? { after: cursor } : {}),
    });
    api<HelpEditorPage>(`/admin/help?${params}`)
      .then((value) => {
        if (active) setPage(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision, filters, cursor]);
  const article = page?.items.find((a) => a.id === selected);
  return (
    <section className="reading">
      <h1>Help content administration</h1>
      <p>
        Requires a current staff MFA session and platform moderation permission.
        Existing article destinations are fixed. Select another article only
        after saving or discarding your draft.
      </p>
      <a href="/help">View public Help</a>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => setRevision((v) => v + 1)}>
            Retry articles
          </button>
        </>
      ) : !page ? (
        <p role="status">Loading articles…</p>
      ) : creating ? (
        <HelpCreationForm
          done={() => {
            setCreating(false);
            setSelected("");
            setFilters({ q: "", status: "all" });
            setCursor(null);
            setRevision((v) => v + 1);
          }}
        />
      ) : (
        <>
          {!article && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  setFilters({
                    q: String(data.get("q") ?? "").trim(),
                    status: String(data.get("status") ?? "all"),
                  });
                  setCursor(null);
                }}
              >
                <label>
                  Find article by ID or question
                  <input name="q" maxLength={100} defaultValue={filters.q} />
                </label>
                <label>
                  Publication status
                  <select name="status" defaultValue={filters.status}>
                    <option value="all">All articles</option>
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                  </select>
                </label>
                <button>Apply filters</button>
              </form>
              <p>
                Showing {page.items.length} articles on this page, ordered by
                article ID. Search by ID to find a newly created draft.
              </p>
              {!page.items.length && (
                <p role="status">
                  No articles match these filters on this page.
                </p>
              )}
              <nav aria-label="Help article pages">
                <button
                  onClick={() => {
                    setCursor(null);
                    setRevision((v) => v + 1);
                  }}
                >
                  First page / refresh
                </button>
                {page.nextCursor && (
                  <button onClick={() => setCursor(page.nextCursor)}>
                    Next page
                  </button>
                )}
              </nav>
            </>
          )}
          {!article && (
            <button onClick={() => setCreating(true)}>
              Create help article
            </button>
          )}
          {!article && (
            <label>
              Article
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Choose an article</option>
                {page.items.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.question} ({a.published ? "Published" : "Unpublished"})
                  </option>
                ))}
              </select>
            </label>
          )}
          {article && (
            <HelpArticleEditor
              key={`${article.id}:${article.version}:${revision}`}
              article={article}
              reload={() => {
                setSelected("");
                setRevision((v) => v + 1);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
