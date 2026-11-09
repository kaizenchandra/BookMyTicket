import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
type Page = {
  items: {
    purpose: string;
    policyVersion: number;
    granted: boolean;
    preferenceVersion: number;
    recordedAt: string;
  }[];
  nextCursor: number | null;
};
export function MarketingConsentHistory({ revision }: { revision: number }) {
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
    api<Page>(
      `/profile/communications/history${cursor ? `?beforeVersion=${cursor}` : ""}`,
    )
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
  }, [opened, cursor, revision, refresh]);
  return (
    <section aria-label="Marketing consent history">
      <h3>Marketing email consent history</h3>
      <p>
        Recorded grants and withdrawals of optional marketing email permission.
        These records do not change required transactional communications or
        prove that an email was sent.
      </p>
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
              No recorded consent changes on this page. No record does not mean
              marketing permission was granted.
            </p>
          )}
          {data.items.map((item) => (
            <article key={item.preferenceVersion}>
              <h4>
                {item.granted ? "Permission granted" : "Permission withdrawn"}
              </h4>
              <p>
                Marketing email · consent policy version {item.policyVersion} ·
                preference version {item.preferenceVersion}
              </p>
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
