import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
type Page = {
  items: {
    purpose: string;
    policyVersion: number;
    policyText: string | null;
    granted: boolean;
    preferenceVersion: number;
    recordedAt: string;
  }[];
  nextCursor: number | null;
};
export function ConsentHistory({
  revision,
  endpoint,
  title,
  purpose,
  description,
}: {
  revision: number;
  endpoint: string;
  title: string;
  purpose: string;
  description: string;
}) {
  const [opened, setOpened] = useState(false),
    [pages, setPages] = useState<(number | null)[]>([null]),
    [data, setData] = useState<Page | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [refresh, setRefresh] = useState(0);
  const generation = useRef(0),
    cursor = pages.at(-1);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setOpened(false);
      setData(null);
      setError("");
      setPages([null]);
      setLoading(false);
    };
    window.addEventListener("bmt-session", clear);
    return () => {
      generation.current++;
      window.removeEventListener("bmt-session", clear);
    };
  }, []);
  useEffect(() => {
    setPages([null]);
  }, [revision]);
  useEffect(() => {
    if (!opened) return;
    let active = true;
    const started = generation.current;
    setData(null);
    setError("");
    setLoading(true);
    api<Page>(`${endpoint}${cursor ? `?beforeVersion=${cursor}` : ""}`)
      .then((r) => {
        if (active && started === generation.current) setData(r);
      })
      .catch((e) => {
        if (active && started === generation.current) setError(e.message);
      })
      .finally(() => {
        if (active && started === generation.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [opened, cursor, revision, refresh, endpoint]);
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <p>{description}</p>
      <button
        disabled={loading}
        onClick={() => {
          setOpened(true);
          setPages([null]);
          setRefresh((r) => r + 1);
        }}
      >
        {opened ? "Refresh consent history" : "View consent history"}
      </button>
      {loading && <p role="status">Loading consent history…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          {data.items.length === 0 && (
            <p>
              No recorded consent entries on this page. An empty history does
              not imply permission was granted.
            </p>
          )}
          {data.items.map((item) => (
            <article key={item.preferenceVersion}>
              <h4>
                {item.granted ? "Permission granted" : "Permission withdrawn"}
              </h4>
              <p>
                {purpose} · consent policy version {item.policyVersion} ·
                preference version {item.preferenceVersion}
              </p>
              <ConsentWording text={item.policyText} />
              <time dateTime={item.recordedAt}>
                {new Date(item.recordedAt).toLocaleString("en-IN")}
              </time>
            </article>
          ))}
        </>
      )}
      {opened && (
        <nav aria-label="Consent history pages">
          <button
            disabled={loading || pages.length === 1}
            onClick={() => setPages([null])}
          >
            First page
          </button>
          <button
            disabled={loading || pages.length === 1}
            onClick={() => setPages((p) => p.slice(0, -1))}
          >
            Previous page
          </button>
          <span>Page {pages.length}</span>
          <button
            disabled={loading || !data?.nextCursor}
            onClick={() => setPages((p) => [...p, data!.nextCursor])}
          >
            Next page
          </button>
        </nav>
      )}
    </section>
  );
}

export function ConsentWording({ text }: { text: string | null }) {
  return text === null ? (
    <p>Consent wording was not retained for this record.</p>
  ) : (
    <details>
      <summary>Recorded consent wording</summary>
      <p style={{ whiteSpace: "pre-wrap" }}>{text}</p>
    </details>
  );
}
